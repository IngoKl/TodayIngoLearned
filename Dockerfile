FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000

RUN [ "node", "install.js", "createdb" ]
RUN [ "node", "install.js", "populatedb" ]
# This is a randomly generated password. Don't forget to change it!
RUN [ "node", "install.js", "setuserpassword", "Ingo", "nUY5SeKpFj" ]
CMD [ "node", "server.js" ]