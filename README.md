# gcloud-node-bigquery-manystreams-bug
To reproduce a bug with google cloud node bigquery - it sometimes silently drops a variable subset of streams when many streams are used in parallel.

This seems to reproduce reliably sometimes, and other times it reliably does not reproduce. To try and get the opposite result, try again later and/or change the load with the env variables.

This small bug reproduction project is the result of troubleshooting missing big query data in a production system.

## How to reproduce the bug

### setup
```bash
git clone https://github.com/chrishiestand/gcloud-node-bigquery-manystreams-bug.git
cd gcloud-node-bigquery-manystreams-bug
npm install
cp .env.example .env
# copy a gcp credentials file into secret/ and update .env keyFilePath and projectId
```

### Run the test

```bash
npm test
```

If the test passes, the bug has not reproduced. Try again and try increasing the env values of `totalStreams`, `streamLength`, and `queryLatencyMs`

If the test fails, the bug might have reproduced or there may have not been enough wait time between the write and the subsequent query. Look at the Big Query UI and verify that the table still does not contain the number of expected rows.
