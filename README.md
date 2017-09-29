# gcloud-node-bigquery-manystreams-bug
To reproduce a bug with google cloud node bigquery - it sometimes silently drops a variable subset of streams when many streams are used in parallel.

When the bug reproduces and `n` streams of size `s` are dropped bigquery will have `n` * `s` missing rows. So if `n=2` and `s=150` bigquery will be missing 300 rows. In other words, the problem does not appear to be that a subset of stream data is missing, but rather one or more entire streams are missing.

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
