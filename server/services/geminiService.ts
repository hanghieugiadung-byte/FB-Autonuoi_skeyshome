import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  KnowledgeDoc,
  KnowledgeSourceType,
  PostGoal,
  RagChunkMatch,
  SafetyConfig,
  ScannedPost,
} from '../../shared/types.ts';
import {
  classifyMediaKind,
  decodePlainTextBuffer,
  extractTextFromZipOfficeXml,
  inferMimeType,
  isMostlyPrintableText,
  isOfficeOpenXmlSource,
  isPlainTextSource,
} from '../lib/mediaKnowledge.ts';
import { buildUtmUrl, retrieveRelevantChunks } from '../lib/rag.ts';
import { checkDuplicateCommentRisk } from '../lib/safety.ts';

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

export interface GeneratedReplyResult {
  replyText: string;
  citations: string[];
  matchedChunks: RagChunkMatch[];
  usedGemini: boolean;
  duplicateRiskScore: number;
}

export async function generateContextualReply(params: {
  post: ScannedPost;
  docs: KnowledgeDoc[];
  safety: SafetyConfig;
  recentReplies: string[];
  toneOverride?: string;
}): Promise<GeneratedReplyResult> {
  const { post, docs, safety, recentReplies, toneOverride } = params;

  const query = `${post.keywordFound} ${post.content}`;
  const matchedChunks = retrieveRelevantChunks(query, docs, 3);
  const citations = Array.from(new Set(matchedChunks.map((c) => c.docTitle)));

  const utmLink = safety.targetLandingUrl
    ? buildUtmUrl(safety.targetLandingUrl, {
        source: safety.utmSource || 'facebook_group',
        medium: safety.utmMedium || 'ai_comment',
        campaign: safety.utmCampaign || 'social_listening',
        content: post.keywordFound,
      })
    : '';

  const knowledgeContext =
    matchedChunks.length > 0
      ? matchedChunks
          .map((c, idx) => `[Tài liệu ${idx + 1}: ${c.docTitle}]\n${c.snippet}`)
          .join('\n\n')
      : 'Chưa có tài liệu nguồn cụ thể trong Kho tài liệu.';

  if (!ai) {
    throw new Error(
      'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập biến môi trường GEMINI_API_KEY trong bảng Secrets của AI Studio.'
    );
  }

  const systemInstruction = `Bạn là chuyên gia tư vấn bán hàng & community marketing trên Facebook Group tại Việt Nam.
Nhiệm vụ: Viết 1 bình luận phản hồi tự nhiên, chân thành, đúng trọng tâm câu hỏi của khách hàng, dựa HOÀN TOÀN vào thông tin trong [Kho tài liệu nguồn] được cung cấp.
Quy tắc bắt buộc:
1. Viết bằng tiếng Việt tự nhiên như người thật đang chia sẻ kinh nghiệm trong Group (2-4 câu ngắn gọn, không sáo rỗng, không dùng hashtag, không spam icon quá mức).
2. Chỉ trích dẫn thông số, giá bán, chính sách bảo hành có trong [Kho tài liệu nguồn]. Không tự bịa thông số.
3. Nếu có link tham khảo (${utmLink || 'không có'}), chỉ chèn tinh tế ở cuối bình luận khi phù hợp.
4. Tránh trùng lặp cấu trúc câu với các bình luận gần đây để chống Facebook đánh dấu spam.
${toneOverride ? `5. Phong cách yêu cầu thêm: ${toneOverride}` : ''}`;

  const prompt = `
[Ngữ cảnh khách hàng trên Facebook Group]
- Nhóm: ${post.groupName}
- Loại: ${post.postType} (${post.intent})
- Từ khóa khớp: "${post.keywordFound}"
- Tác giả: ${post.authorName}
- Nội dung khách hàng: "${post.content}"

[Kho tài liệu nguồn (RAG)]
${knowledgeContext}

${recentReplies.length > 0 ? `[Các bình luận đã tạo trước đó - hãy viết khác biệt để tránh trùng lặp]\n- ${recentReplies.slice(0, 3).join('\n- ')}` : ''}

Hãy trả về duy nhất nội dung bình luận phản hồi (không kèm lời giải thích hay dấu ngoặc kép bao quanh).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const replyText = (response.text ?? '').trim();
  if (!replyText) {
    throw new Error('Gemini API không trả về nội dung phản hồi.');
  }

  const dupCheck = checkDuplicateCommentRisk(replyText, recentReplies);

  return {
    replyText,
    citations,
    matchedChunks,
    usedGemini: true,
    duplicateRiskScore: dupCheck.maxSimilarity,
  };
}

export interface ExtractedFileKnowledge {
  extractedText: string;
  sourceType: KnowledgeSourceType;
  mimeType: string;
  usedGemini: boolean;
}

const INLINE_LIMIT_BYTES = 12 * 1024 * 1024;

async function withGeminiUploadedFile<T>(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fn: (fileUri: string, resolvedMime: string) => Promise<T>
): Promise<T> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  }

  const ext = path.extname(fileName) || '';
  const tmpPath = path.join(os.tmpdir(), `spfb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  await fs.writeFile(tmpPath, buffer);

  let uploadedName: string | undefined;
  try {
    const uploaded = await ai.files.upload({
      file: tmpPath,
      config: { mimeType, displayName: fileName },
    });
    uploadedName = uploaded.name;

    let fileInfo = uploaded;
    let attempts = 0;
    while (fileInfo.state === 'PROCESSING' && attempts < 45) {
      await new Promise((r) => setTimeout(r, 1500));
      if (!uploaded.name) break;
      fileInfo = await ai.files.get({ name: uploaded.name });
      attempts++;
    }

    if (fileInfo.state === 'FAILED') {
      throw new Error(`Gemini không thể xử lý file "${fileName}".`);
    }
    if (!fileInfo.uri) {
      throw new Error(`Không nhận được URI sau khi tải file "${fileName}" lên Gemini.`);
    }

    return await fn(fileInfo.uri, fileInfo.mimeType || mimeType);
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
    if (uploadedName) {
      await ai.files.delete({ name: uploadedName }).catch(() => undefined);
    }
  }
}

export async function extractKnowledgeFromUploadedFile(params: {
  buffer: Buffer;
  fileName: string;
  declaredMimeType?: string;
}): Promise<ExtractedFileKnowledge> {
  const { buffer, fileName, declaredMimeType } = params;
  const mimeType = inferMimeType(fileName, declaredMimeType);
  const sourceType = classifyMediaKind(fileName, mimeType);

  if (buffer.length === 0) {
    throw new Error('File tải lên đang rỗng (0 bytes).');
  }

  // 1. Plain text, Markdown, CSV, JSON, HTML, XML
  if (isPlainTextSource(fileName, mimeType)) {
    const text = decodePlainTextBuffer(buffer, fileName, mimeType);
    if (!text) {
      throw new Error('Không tìm thấy nội dung văn bản trong file.');
    }
    return { extractedText: text, sourceType, mimeType, usedGemini: false };
  }

  // 2. Office OpenXML (.docx / .pptx / .xlsx) local ZIP XML extraction
  if (isOfficeOpenXmlSource(fileName, mimeType)) {
    const officeText = extractTextFromZipOfficeXml(buffer);
    if (officeText) {
      return { extractedText: officeText, sourceType: 'document', mimeType, usedGemini: false };
    }
  }

  // 3. Fallback readable plain text for unknown extensions
  if (mimeType === 'application/octet-stream' && isMostlyPrintableText(buffer)) {
    const text = decodePlainTextBuffer(buffer, fileName, 'text/plain');
    if (text) {
      return { extractedText: text, sourceType: 'text', mimeType: 'text/plain', usedGemini: false };
    }
  }

  if (!ai) {
    throw new Error(
      'File âm thanh, video, hình ảnh hoặc PDF cần GEMINI_API_KEY trên máy chủ để trích xuất nội dung cho RAG.'
    );
  }

  // 4. Audio files -> Speech-to-Text via gemini-3.5-transcribe
  if (sourceType === 'audio') {
    const instruction =
      'Hãy chép lời (transcribe) đầy đủ, chính xác toàn bộ nội dung tiếng nói trong file âm thanh này bằng tiếng Việt (giữ nguyên tên sản phẩm, mã số, giá bán, số điện thoại, thông số kỹ thuật và chính sách bảo hành nếu có).';

    let response;
    if (buffer.length <= INLINE_LIMIT_BYTES) {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            { text: instruction },
          ],
        },
      });
    } else {
      response = await withGeminiUploadedFile(buffer, fileName, mimeType, (fileUri, resolvedMime) =>
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              { fileData: { fileUri, mimeType: resolvedMime } },
              { text: instruction },
            ],
          },
        })
      );
    }

    const transcript = (response.text ?? '').trim();
    if (!transcript) {
      throw new Error('Không trích xuất được lời thoại từ file âm thanh.');
    }
    return {
      extractedText: `[Nguồn Âm thanh: ${fileName}]\n${transcript}`,
      sourceType: 'audio',
      mimeType,
      usedGemini: true,
    };
  }

  // 5. Video, Image, PDF & rich documents -> Multimodal extraction via gemini-4-hydrogen
  const promptByKind: Record<string, string> = {
    video: `Phân tích toàn bộ video "${fileName}" và trích xuất kiến thức sản phẩm/dịch vụ để nạp vào Kho dữ liệu RAG bán hàng.
Hãy ghi rõ bằng tiếng Việt:
1. Toàn bộ lời thoại / thuyết minh quan trọng trong video.
2. Mọi chữ, bảng giá, thông số kỹ thuật, mã sản phẩm, ưu đãi hiển thị trên màn hình.
3. Các điểm nổi bật trực quan của sản phẩm & câu hỏi thường gặp khách hàng hay quan tâm.
Chỉ ghi thông tin thực tế có trong video.`,
    image: `Đọc toàn bộ chữ (OCR) và phân tích chi tiết hình ảnh "${fileName}" để nạp vào Kho dữ liệu RAG tư vấn khách hàng.
Hãy trích xuất đầy đủ bằng tiếng Việt: tên sản phẩm, mã hàng, thông số kỹ thuật, bảng giá, khuyến mãi, chính sách bảo hành/giao hàng và các điểm nổi bật trên ảnh.`,
    document: `Đọc và trích xuất đầy đủ thông tin từ tài liệu "${fileName}" bằng tiếng Việt (giữ nguyên các thông số kỹ thuật, bảng giá, mã sản phẩm, điều kiện khuyến mãi, bảo hành và quy trình tư vấn) thành các đoạn văn rõ ràng để phục vụ tìm kiếm RAG.`,
  };

  const extractionPrompt = promptByKind[sourceType] ?? promptByKind.document;

  let response;
  if (buffer.length <= INLINE_LIMIT_BYTES && sourceType !== 'video') {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          { text: extractionPrompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  } else {
    response = await withGeminiUploadedFile(buffer, fileName, mimeType, (fileUri, resolvedMime) =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { fileData: { fileUri, mimeType: resolvedMime } },
            { text: extractionPrompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );
  }

  const extractedText = (response.text ?? '').trim();
  if (!extractedText) {
    throw new Error(`Gemini không trích xuất được nội dung từ file "${fileName}".`);
  }

  return {
    extractedText,
    sourceType,
    mimeType,
    usedGemini: true,
  };
}

export interface GeneratedSocialPostResult {
  title: string;
  postText: string;
  hashtags: string[];
  citations: string[];
  usedGemini: boolean;
}

export async function generateScheduledSocialPost(params: {
  topic: string;
  goal: PostGoal;
  tone: string;
  useRag: boolean;
  docs: KnowledgeDoc[];
  safety: SafetyConfig;
  targetNames: string[];
}): Promise<GeneratedSocialPostResult> {
  const { topic, goal, tone, useRag, docs, safety, targetNames } = params;

  const matchedChunks = useRag && docs.length > 0 ? retrieveRelevantChunks(topic, docs, 3) : [];
  const citations = Array.from(new Set(matchedChunks.map((c) => c.docTitle)));

  const shouldIncludeLink =
    Boolean(safety.targetLandingUrl) &&
    (goal === 'Bán hàng / Chốt đơn' || goal === 'Khuyến mãi' || goal === 'Review sản phẩm');

  const utmLink = shouldIncludeLink
    ? buildUtmUrl(safety.targetLandingUrl, {
        source: safety.utmSource || 'facebook_page',
        medium: 'auto_post',
        campaign: safety.utmCampaign || 'social_listening',
        content: topic.slice(0, 40),
      })
    : '';

  const knowledgeContext =
    matchedChunks.length > 0
      ? matchedChunks
          .map((c, idx) => `[Tài liệu ${idx + 1}: ${c.docTitle}]\n${c.snippet}`)
          .join('\n\n')
      : 'Không sử dụng tài liệu cụ thể — hãy viết nội dung chia sẻ tự nhiên, hữu ích.';

  if (!ai) {
    throw new Error(
      'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập biến môi trường GEMINI_API_KEY trong bảng Secrets của AI Studio.'
    );
  }

  const systemInstruction = `Bạn là chuyên gia Content Marketing & Quản trị Fanpage/Facebook Ads tại Việt Nam.
Nhiệm vụ: Viết 1 bài đăng Facebook hoàn chỉnh để đăng tự động lên Nick FB cá nhân / Fanpage sở hữu nhằm tăng độ Trust và chuyển đổi khách hàng.
Quy tắc:
1. Viết tiếng Việt tự nhiên, bố cục thoáng rõ 2-3 đoạn ngắn dễ đọc trên mobile. Không dùng markdown ** hay ##.
2. Nếu có [Kho tài liệu nguồn (RAG)], chỉ trích dẫn đúng thông số, giá bán, ưu đãi, bảo hành từ tài liệu đó.
3. Mục tiêu bài viết: "${goal}". Tone giọng: "${tone}".
4. ${utmLink ? `Chèn tự nhiên đường link UTM tham khảo này ở đoạn CTA cuối bài: ${utmLink}` : 'Không cần chèn link bán hàng nếu mục tiêu là nuôi tương tác tự nhiên.'}
5. Đề xuất 3-5 hashtag tiếng Việt liên quan không dấu ở mảng hashtags.`;

  const prompt = `Chủ đề / Sản phẩm cần viết: "${topic}"
Các kênh đích sẽ đăng: ${targetNames.length > 0 ? targetNames.join(', ') : 'Fanpage & Nick FB sở hữu'}

[Kho tài liệu nguồn (RAG)]
${knowledgeContext}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Tiêu đề ngắn tóm tắt chiến dịch bài đăng (dưới 65 ký tự)',
          },
          postText: {
            type: Type.STRING,
            description: 'Nội dung hoàn chỉnh của bài đăng Facebook',
          },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Danh sách 3-5 hashtag bắt đầu bằng dấu #',
          },
        },
        required: ['title', 'postText', 'hashtags'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini API không trả về nội dung bài đăng.');
  }

  const parsed = JSON.parse(rawText) as {
    title?: string;
    postText?: string;
    hashtags?: string[];
  };

  if (!parsed.postText?.trim()) {
    throw new Error('Gemini API trả về nội dung bài đăng rỗng.');
  }

  return {
    title: (parsed.title || topic).trim().slice(0, 90),
    postText: parsed.postText.trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 6)
      : ['#SocialPulse', '#KinhNghiemThucTe'],
    citations,
    usedGemini: true,
  };
}
