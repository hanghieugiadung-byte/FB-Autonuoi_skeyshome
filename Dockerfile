FROM node:22-slim

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

RUN mkdir -p /app/data
EXPOSE 3000

CMD ["npm", "start"]
