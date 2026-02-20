# Build stage
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package*.json ./

RUN npm install --production

# Create a small server to serve static files AND the API
# Or we can just use the geocode-server.mjs and modify it slightly to serve static files
# But let's keep it simple: we'll use a simple express-like server or just node http

EXPOSE 8787

# We'll use a modified geocode-server.mjs to serve the frontend too
# For now, let's just create a dedicated entrypoint
COPY prod-server.mjs ./prod-server.mjs

CMD ["node", "prod-server.mjs"]
