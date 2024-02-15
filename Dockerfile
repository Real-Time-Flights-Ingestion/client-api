# use current release
FROM node:21.6

# build arguments
ARG PORT=5555

# set NODE_ENV production before npm install to avoid installing dev dependencies
ENV NODE_ENV production
# verbose by default
ENV NPM_CONFIG_LOGLEVEL info

# manage files with a non-root user
USER node
WORKDIR /app

# create a layer for dependencies to take advantage of Docker layer caching,
# since dependencies will change less often than source code
COPY --chown=node package.json package-lock.json ./
# npm ci is like npm install but more strict: makes a clean install and prevents modifying package-lock.json
RUN npm ci

# source code
COPY --chown=node ./ ./

# port
ENV PORT=$PORT
EXPOSE $PORT

CMD [ "node", "index.js" ]
