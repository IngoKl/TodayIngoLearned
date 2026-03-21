FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000

# Initialize database and start server via entrypoint script
# Run setup commands before starting the server
RUN echo '#!/bin/sh' > /usr/src/app/entrypoint.sh && \
    echo 'if [ ! -f ./db/til.db ]; then' >> /usr/src/app/entrypoint.sh && \
    echo '  node install.js createdb' >> /usr/src/app/entrypoint.sh && \
    echo '  node install.js populatedb' >> /usr/src/app/entrypoint.sh && \
    echo 'fi' >> /usr/src/app/entrypoint.sh && \
    echo 'exec node server.js' >> /usr/src/app/entrypoint.sh && \
    chmod +x /usr/src/app/entrypoint.sh

CMD ["/usr/src/app/entrypoint.sh"]
