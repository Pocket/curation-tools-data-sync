# CurationToolsDataSync

This repository contains all the ETL components and business logic to sync the items added in the new CuratedCorpusApi to the database to the readitla-* database.

## Folder structure
- the infrastructure code is present in `.aws`
- the application code is in `src`
- `.docker` contains local setup
- `.circleci` contains circleCI setup

## Develop Locally
```bash
npm install
npm start:dev
```

## Start docker
```bash
# npm ci not required if already up-to-date
npm ci
docker compose up
```
