FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# COPY package.json and package-lock.json
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy source files
COPY . .

# Generate Prisma client and build TS
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
