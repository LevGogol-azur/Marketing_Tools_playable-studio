FROM node:22-slim

# TLS roots for reaching api.anthropic.com
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /agent

# Silence the npm "new version available" notice (build + runtime)
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Install deps first so the layer is cached unless package.json changes
COPY package.json ./
RUN npm install --omit=dev

COPY runner.ts ./

# Run non-root. The base image already ships a `node` user at UID 1000.
# /work is bind-mounted at runtime by the host.
USER node
ENV HOME=/home/node

ENTRYPOINT ["npx", "tsx", "runner.ts"]
