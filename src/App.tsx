import { useCallback, useEffect, useState } from 'react';
import type {
  AdminUser,
  DashboardSnapshot,
  FacebookAccount,
  FacebookGroup,
  Fanpage,
  GroupDataset,
  KnowledgeDoc,
  PostGoal,
  PostRecurrence,
  PostTargetRef,
  SafetyConfig,
  ScannedPost,
  ScheduledPost,
  SystemSettings,
} from '../shared/types';
import { AccountsView } from './components/AccountsView';
import { AiContentView } from './components/AiContentView';
import { AutoPublisherView } from './components/AutoPublisherView';
import { DashboardView } from './components/DashboardView';
import { GroupFinderView } from './components/GroupFinderView';
import { KeywordScannerView } from './components/KeywordScannerView';
import { LoginView } from './components/LoginView';
import { NurtureCenterView } from './components/NurtureCenterView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SafetyOptimizeView } from './components/SafetyOptimizeView';
import { Sidebar, type NavTab } from './components/Sidebar';
import { SystemAdminView } from './components/SystemAdminView';
import { TopBar } from './components/TopBar';
import { apiFetch, buildAuthUrl, clearAuthToken } from './utils/authToken';
import { canUserAccess } from './utils/rbac';

interface StarterScript {
  filename: string;
  title: string;
  description: string;
  code: string;
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [fanpages, setFanpages] = useState<Fanpage[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [datasets, setDatasets] = useState<GroupDataset[]>([]);
  const [groups, setGroups] = useState<FacebookGroup[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('ALL');

  const [posts, setPosts] = useState<ScannedPost[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [scripts, setScripts] = useState<StarterScript[]>([]);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [scannerDatasetPreset, setScannerDatasetPreset] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setSystemSettings(data.systemSettings ?? null);
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        } else {
          clearAuthToken();
          setCurrentUser(null);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    const [dashRes, accRes, pageRes, pubRes, dsRes, scanRes, kbRes, scRes] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch('/api/accounts'),
      apiFetch('/api/fanpages'),
      apiFetch('/api/publisher/posts'),
      apiFetch('/api/datasets'),
      apiFetch('/api/scanner'),
      apiFetch('/api/knowledge'),
      apiFetch('/api/scripts'),
    ]);

    if (dashRes.status === 401) {
      clearAuthToken();
      setCurrentUser(null);
      return;
    }

    if (dashRes.ok) {
      const dashData = (await dashRes.json()) as DashboardSnapshot;
      setSnapshot(dashData);
      if (dashData.accounts) setAccounts(dashData.accounts);
      if (dashData.fanpages) setFanpages(dashData.fanpages);
    }
    if (accRes.ok) {
      const accData = await accRes.json();
      setAccounts(accData.accounts ?? []);
    }
    if (pageRes.ok) {
      const pageData = await pageRes.json();
      setFanpages(pageData.fanpages ?? []);
    }
    if (pubRes.ok) {
      const pubData = await pubRes.json();
      setScheduledPosts(pubData.posts ?? []);
    }
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      setDatasets(dsData.datasets ?? []);
      setGroups(dsData.groups ?? []);
    }
    if (scanRes.ok) {
      const scanData = await scanRes.json();
      setPosts(scanData.posts ?? []);
    }
    if (kbRes.ok) {
      const kbData = await kbRes.json();
      setDocs(kbData.docs ?? []);
    }
    if (scRes.ok) {
      const scData = await scRes.json();
      setScripts(scData.scripts ?? []);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetchAllData();

    const evtSource = new EventSource(buildAuthUrl('/api/events'));
    evtSource.onopen = () => setSseConnected(true);
    evtSource.onerror = () => setSseConnected(false);
    evtSource.addEventListener('snapshot', (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as DashboardSnapshot;
        setSnapshot(parsed);
        if (parsed.accounts) setAccounts(parsed.accounts);
        if (parsed.fanpages) setFanpages(parsed.fanpages);
        apiFetch('/api/scanner')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.posts) setPosts(data.posts);
          })
          .catch(() => undefined);
        apiFetch('/api/publisher/posts')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.posts) setScheduledPosts(data.posts);
          })
          .catch(() => undefined);
      } catch {
        // ignore malformed sse payload
      }
    });

    return () => {
      evtSource.close();
      setSseConnected(false);
    };
  }, [currentUser?.id, fetchAllData]);

  useEffect(() => {
    if (!currentUser) return;
    const tabPermissionMap: Partial<Record<NavTab, Parameters<typeof canUserAccess>[1]>> = {
      dashboard: 'view_dashboard',
      accounts: 'manage_fb_accounts',
      nurture: 'manage_nurture',
      'auto-publisher': 'manage_publisher',
      'group-finder': 'run_group_finder',
      'keyword-scanner': 'run_scanner',
      'ai-content': 'manage_ai_rag',
      'safety-optimize': 'manage_safety',
    };
    const needed = tabPermissionMap[activeTab];
    if (needed && !canUserAccess(currentUser, needed)) {
      if (canUserAccess(currentUser, 'view_dashboard')) {
        setActiveTab('dashboard');
      } else {
        setActiveTab('system-admin');
      }
    }
  }, [activeTab, currentUser]);

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearAuthToken();
    setCurrentUser(null);
    setSnapshot(null);
    setActiveTab('dashboard');
  };

  const handleAddAccount = async (payload: {
    name: string;
    fbUid: string;
    cookieData: string;
    proxyEndpoint: string;
    warmupStage: FacebookAccount['warmupStage'];
    recoveryEmail?: string;
    twoFactorSecret?: string;
    maxJoinsPerDay: number;
    maxCommentsPerDay: number;
  }) => {
    const res = await apiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể thêm tài khoản.');
    setAccounts(data.accounts ?? []);
  };

  const handleGeneratePersona = async () => {
    const res = await apiFetch('/api/accounts/generate-persona', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể sinh profile mẫu.');
    return data.persona;
  };

  const handleCreateFanpage = async (payload: {
    ownerAccountId: string;
    name: string;
    category: string;
    description: string;
    pageSlug?: string;
    followersCount?: number;
  }) => {
    const res = await apiFetch('/api/fanpages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể khởi tạo Fanpage.');
    setFanpages(data.fanpages ?? []);
  };

  const handleToggleFanpage = async (id: string) => {
    const res = await apiFetch(`/api/fanpages/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) setFanpages(data.fanpages ?? []);
  };

  const handleDeleteFanpage = async (id: string) => {
    const res = await apiFetch(`/api/fanpages/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) setFanpages(data.fanpages ?? []);
  };

  const handleStartWarmup = async (params: { accountIds: string[]; pageIds: string[] }) => {
    const res = await apiFetch('/api/warmup/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể chạy phiên nuôi.');
  };

  const handleStopWarmup = async () => {
    await apiFetch('/api/warmup/stop', { method: 'POST' });
  };

  const handleGenerateAiPost = async (params: {
    topic: string;
    goal: PostGoal;
    tone: string;
    useRag: boolean;
    targetNames: string[];
  }) => {
    const res = await apiFetch('/api/publisher/generate-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể gọi AI sinh bài đăng.');
    return {
      title: data.title,
      postText: data.postText,
      hashtags: data.hashtags ?? [],
      citations: data.citations ?? [],
    };
  };

  const handleCreateScheduledPost = async (payload: {
    title: string;
    topic: string;
    goal: PostGoal;
    tone: string;
    useRag: boolean;
    aiContent: string;
    hashtags: string[];
    aiCitations: string[];
    perTargetVariation: boolean;
    targets: PostTargetRef[];
    scheduledAt: string;
    recurrence: PostRecurrence;
    publishImmediately: boolean;
  }) => {
    const res = await apiFetch('/api/publisher/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể tạo lịch đăng bài.');
    setScheduledPosts(data.posts ?? []);
  };

  const handlePublishScheduledNow = async (id: string) => {
    const res = await apiFetch(`/api/publisher/posts/${encodeURIComponent(id)}/publish-now`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể đăng bài ngay.');
    setScheduledPosts(data.posts ?? []);
  };

  const handleTogglePauseScheduledPost = async (id: string) => {
    const res = await apiFetch(`/api/publisher/posts/${encodeURIComponent(id)}/toggle-pause`, {
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) setScheduledPosts(data.posts ?? []);
  };

  const handleDeleteScheduledPost = async (id: string) => {
    const res = await apiFetch(`/api/publisher/posts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (res.ok) setScheduledPosts(data.posts ?? []);
  };

  const handleToggleAccount = async (id: string) => {
    const res = await apiFetch(`/api/accounts/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) setAccounts(data.accounts ?? []);
  };

  const handleDeleteAccount = async (id: string) => {
    const res = await apiFetch(`/api/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (res.ok) setAccounts(data.accounts ?? []);
  };

  const handleSearchGroups = async (params: {
    keyword: string;
    targetCount: number;
    autoJoinPublic: boolean;
    accountIds: string[];
  }) => {
    const res = await apiFetch('/api/groups/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Tìm kiếm thất bại.');

    setDatasets(data.datasets ?? []);
    const allRes = await apiFetch('/api/datasets');
    if (allRes.ok) {
      const allData = await allRes.json();
      setDatasets(allData.datasets ?? []);
      setGroups(allData.groups ?? []);
    }
    setSelectedDatasetId(data.datasetId);
  };

  const handleManualJoin = async (groupId: string) => {
    const res = await apiFetch(`/api/groups/${encodeURIComponent(groupId)}/join`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể tham gia nhóm.');

    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, joinStatus: data.joinStatus } : g))
    );
  };

  const handleDeleteDataset = async (datasetId: string) => {
    await apiFetch(`/api/datasets/${encodeURIComponent(datasetId)}`, { method: 'DELETE' });
    setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
    setGroups((prev) => prev.filter((g) => g.datasetId !== datasetId));
    if (selectedDatasetId === datasetId) {
      setSelectedDatasetId('ALL');
    }
  };

  const handleStartScan = async (params: {
    datasetId: string;
    trackingKeywords: string[];
    accountIds: string[];
    delayMinSec: number;
    delayMaxSec: number;
  }) => {
    const res = await apiFetch('/api/scanner/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể bắt đầu quét.');
  };

  const handleStopScan = async () => {
    await apiFetch('/api/scanner/stop', { method: 'POST' });
  };

  const handleToggleStream = async (
    streamId: string,
    action: 'running' | 'pause' | 'stop'
  ) => {
    await apiFetch(`/api/streams/${encodeURIComponent(streamId)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  };

  const handleGenerateReply = async (postId: string, toneOverride?: string) => {
    const res = await apiFetch('/api/ai/generate-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, toneOverride }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể sinh phản hồi AI.');

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              aiReply: data.aiReply,
              aiCitations: data.aiCitations ?? [],
              replyStatus: data.replyStatus,
            }
          : p
      )
    );
  };

  const handleSaveReplyAction = async (
    postId: string,
    aiReply: string,
    action: 'save' | 'copy' | 'approve'
  ) => {
    const res = await apiFetch('/api/ai/save-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, aiReply, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể cập nhật trạng thái.');

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, aiReply, replyStatus: data.replyStatus } : p
      )
    );
  };

  const handleAddDoc = async (doc: { title: string; category: string; content: string }) => {
    const res = await apiFetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể lưu tài liệu.');
    setDocs(data.docs ?? []);
  };

  const handleUploadDocFile = async (params: {
    file: File;
    title: string;
    category: string;
  }) => {
    const res = await apiFetch('/api/knowledge/upload', {
      method: 'POST',
      headers: {
        'Content-Type': params.file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(params.file.name),
        'X-File-Mime': params.file.type || 'application/octet-stream',
        'X-Doc-Title': encodeURIComponent(params.title),
        'X-Doc-Category': encodeURIComponent(params.category),
      },
      body: params.file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể trích xuất nội dung từ file.');
    setDocs(data.docs ?? []);
    return {
      sourceType: String(data.sourceType ?? 'document'),
      chunkCount: Number(data.chunkCount ?? 1),
    };
  };

  const handleDeleteDoc = async (docId: string) => {
    const res = await apiFetch(`/api/knowledge/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (res.ok) {
      setDocs(data.docs ?? []);
    }
  };

  const handleSaveSafety = async (patch: Partial<SafetyConfig>) => {
    const res = await apiFetch('/api/safety', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể cập nhật cấu hình.');
    setSnapshot((prev) =>
      prev
        ? {
            ...prev,
            safetyConfig: data.safetyConfig,
            usageToday: data.usageToday,
          }
        : prev
    );
  };

  const runningStreamsCount =
    snapshot?.streams.filter((s) => s.status === 'running').length ?? 0;
  const pendingAiCount = posts.filter((p) => p.replyStatus === 'Chưa tạo').length;
  const activeAccountsCount = accounts.filter((a) => a.enabled).length;
  const scheduledPostsCount = scheduledPosts.filter((p) => p.status === 'scheduled').length;
  const scannerStream = snapshot?.streams.find((s) => s.module === 'keyword_scanner');
  const warmupStream = snapshot?.streams.find((s) => s.module === 'warmup_worker');
  const publisherStream = snapshot?.streams.find((s) => s.module === 'auto_publisher');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-700">
          Đang kiểm tra phiên đăng nhập hệ thống...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        systemSettings={systemSettings}
        onLoginSuccess={({ user, systemSettings: nextSettings }) => {
          setCurrentUser(user);
          setSystemSettings(nextSettings);
          setActiveTab(canUserAccess(user, 'view_dashboard') ? 'dashboard' : 'system-admin');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-white text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        runningStreamsCount={runningStreamsCount}
        pendingAiCount={pendingAiCount}
        activeAccountsCount={activeAccountsCount}
        fanpagesCount={fanpages.length}
        scheduledPostsCount={scheduledPostsCount}
        currentUser={currentUser}
        workspaceName={systemSettings?.workspaceName}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col bg-white">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onPrimaryAction={() => setActiveTab('group-finder')}
          currentUser={currentUser}
          workspaceName={systemSettings?.workspaceName}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto bg-white">
          {systemSettings?.maintenanceMode && (
            <div
              role="status"
              className="mb-5 px-4 py-3 rounded-xl bg-white border-2 border-amber-400 text-xs font-semibold text-amber-900 flex items-center justify-between gap-3"
            >
              <span>
                Chế độ Bảo trì đang BẬT — Các tài khoản không phải Admin tạm thời bị hạn chế thao tác.
              </span>
              {canUserAccess(currentUser, 'manage_system_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('system-admin')}
                  className="text-blue-700 hover:underline shrink-0"
                >
                  Tắt trong Quản trị Hệ thống →
                </button>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              snapshot={snapshot}
              sseConnected={sseConnected}
              onToggleStream={handleToggleStream}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsView
              accounts={accounts}
              onAddAccount={handleAddAccount}
              onToggleAccount={handleToggleAccount}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeTab === 'nurture' && (
            <NurtureCenterView
              accounts={accounts}
              fanpages={fanpages}
              warmupStream={warmupStream}
              onGeneratePersona={handleGeneratePersona}
              onCreateAccount={handleAddAccount}
              onCreateFanpage={handleCreateFanpage}
              onToggleFanpage={handleToggleFanpage}
              onDeleteFanpage={handleDeleteFanpage}
              onStartWarmup={handleStartWarmup}
              onStopWarmup={handleStopWarmup}
            />
          )}

          {activeTab === 'auto-publisher' && (
            <AutoPublisherView
              accounts={accounts}
              fanpages={fanpages}
              posts={scheduledPosts}
              docsCount={docs.length}
              publisherStream={publisherStream}
              onGenerateAiPost={handleGenerateAiPost}
              onCreateScheduledPost={handleCreateScheduledPost}
              onPublishNow={handlePublishScheduledNow}
              onTogglePause={handleTogglePauseScheduledPost}
              onDeletePost={handleDeleteScheduledPost}
            />
          )}

          {activeTab === 'group-finder' && (
            <GroupFinderView
              datasets={datasets}
              groups={groups}
              accounts={accounts}
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={setSelectedDatasetId}
              onSearchGroups={handleSearchGroups}
              onManualJoin={handleManualJoin}
              onDeleteDataset={handleDeleteDataset}
              onJumpToScanner={(dsId) => {
                setScannerDatasetPreset(dsId);
                setActiveTab('keyword-scanner');
              }}
            />
          )}

          {activeTab === 'keyword-scanner' && (
            <KeywordScannerView
              datasets={datasets}
              posts={posts}
              accounts={accounts}
              scannerStream={scannerStream}
              initialDatasetId={scannerDatasetPreset}
              onStartScan={handleStartScan}
              onStopScan={handleStopScan}
              onOpenInAiWorkbench={(postId) => {
                setFocusedPostId(postId);
                setActiveTab('ai-content');
              }}
            />
          )}

          {activeTab === 'ai-content' && (
            <AiContentView
              posts={posts}
              docs={docs}
              focusedPostId={focusedPostId}
              onGenerateReply={handleGenerateReply}
              onSaveReplyAction={handleSaveReplyAction}
              onAddDoc={handleAddDoc}
              onUploadDocFile={handleUploadDocFile}
              onDeleteDoc={handleDeleteDoc}
            />
          )}

          {activeTab === 'safety-optimize' && (
            <SafetyOptimizeView
              safetyConfig={snapshot?.safetyConfig ?? null}
              usageToday={snapshot?.usageToday ?? null}
              scripts={scripts}
              onSaveSafety={handleSaveSafety}
            />
          )}

          {activeTab === 'system-admin' && (
            <SystemAdminView
              currentUser={currentUser}
              systemSettings={systemSettings}
              onSystemSettingsUpdated={setSystemSettings}
            />
          )}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
