FROM node:15.6.0
WORKDIR /app
ADD . /app
RUN npm install
EXPOSE 3301
CMD node app.js