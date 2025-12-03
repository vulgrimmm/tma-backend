FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the code
COPY . .

# Environment
ENV PORT=3001

# Start the server
CMD ["node", "server.js"]
