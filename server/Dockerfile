FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# Install all deps including devDependencies (tsc needs them at build time)
RUN npm ci --include=dev

COPY . .

RUN npm run build

# Remove devDependencies from the final image
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/index.js"]
