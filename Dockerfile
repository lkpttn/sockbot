FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create data directory for persistence
RUN mkdir -p /app/data && chown node:node /app/data

# Run as non-root user
USER node

CMD ["node", "src/index.js"]
