FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY *.js ./
COPY fonts ./fonts
COPY assets ./assets
EXPOSE 3000
CMD ["node", "server.js"]
