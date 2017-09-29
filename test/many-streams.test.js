import path from 'path'
import {Readable} from 'stream'

import bluebird from 'bluebird'
import dotenv from 'dotenv'
import gbq from '@google-cloud/bigquery'
import ramda from 'ramda'
import test from 'ava'

process.on('unhandledRejection', (error) => {
  throw error
})

process.on('uncaughtException', (error) => {
  throw error
})

dotenv.config()

// HEY YOU! Set these 3 variables!
let {totalStreams, keyFilePath, projectId, queryLatencyMs, bQTableBaseName} = process.env

totalStreams = parseInt(totalStreams)

if (queryLatencyMs) {
    queryLatencyMs = parseInt(queryLatencyMs)
} else {
    queryLatencyMs = 15000
}

if (!totalStreams || !keyFilePath || !projectId || !bQTableBaseName) {
    console.error('Please setup your .env file. Use .env.example as an example')
    process.exit(1)
}

if (!path.isAbsolute(keyFilePath)) {
    keyFilePath = path.join(__dirname, '..', keyFilePath)
}

const streamLength = 150
const gbqClient = gbq({projectId, keyFilename: keyFilePath})
const bQDatasetName = 'stream_bug_test'

let bQTableName = ''

const schema = {
  bucket         : 'string',
  clientIp       : 'string',
  clientLatitude : 'float',
  clientLongitude: 'float',
  filePath       : 'string',
  hitMiss        : 'string',
  numBytes       : 'integer',
  originalHost   : 'string',
  popGeoRegion   : 'string',
  responseCode   : 'integer',
  timeDurationMs : 'integer',
  unixtimeStart  : 'timestamp',
}

const testData = {
  bucket         : 'de840a651ae9430ea769aa996ff694961d409ee3-bucket',
  clientIp       : '500.400.300.256',
  clientLatitude : '123.456',
  clientLongitude: '-456.789',
  filePath       : '/path/to/file.png',
  hitMiss        : 'HIT',
  numBytes       : '789',
  originalHost   : 'myhost.domain.com',
  popGeoRegion   : 'US-East',
  responseCode   : '200',
  timeDurationMs : '45',
  unixtimeStart  : 1506384237.974667
}

const testDataStr = JSON.stringify(testData) + '\n'

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function schemaToString(schema) {

  const pairs = []

  ramda.mapObjIndexed((type, name) => {
    pairs.push(`${name}:${type}`)
  }, schema)

  const string = pairs.join(',')
  return string
}

async function makeTableP({gbqClient, gbqDatasetName, gbqTableName}) {

  const schemaObj    = schema
  const schemaString = schemaToString(schemaObj)

  const datasetResponse = await gbqClient.dataset(gbqDatasetName).get({autoCreate: true})
  const gbqDataset      = datasetResponse[0]
  const tableResponse   = await gbqDataset.table(gbqTableName).get({schema: schemaString, autoCreate: true})
  return tableResponse[0]
}

function createReadStream() {

  return new Readable({

    objectMode   : true,
    highWaterMark: 150,

    read(_size) {
      const thisStream = this
      ramda.range(0, streamLength).map(() => {
        thisStream.push(testDataStr)
      })
      thisStream.push(null)
    },
  })
}

function streamsToGcloudPromiseP(readStream, writeStream) {

  return new Promise((resolve, reject) => {

    writeStream.on('error', reject)
    writeStream.on('complete', resolve)

    readStream.pipe(writeStream)
  })
}

test.beforeEach('setup table', async t => {

  const randInt = getRandomInt(1, 99999999)
  bQTableName = `${bQTableBaseName}_${randInt}`
  console.log(`using table name ${bQTableName}`)

  const gbqTable = await makeTableP({gbqClient, gbqDatasetName: bQDatasetName, gbqTableName: bQTableName})

  t.context.table = gbqTable
})

test('run and verify result', async (t) => {

  const promises = ramda.range(0, totalStreams).map(() => {

    const readStream  = createReadStream()
    const writeStream = t.context.table.createWriteStream({
      sourceFormat: 'NEWLINE_DELIMITED_JSON'
    })

    return streamsToGcloudPromiseP(readStream, writeStream)
  })

  await Promise.all(promises)

  console.log(`writes complete, waiting ${queryLatencyMs / 1000}s for data to process...`)

  // give BQ time to process the data
  await bluebird.delay(queryLatencyMs)

  const queryString = `SELECT COUNT(bucket) FROM [${projectId}:${bQDatasetName}.${bQTableName}]`

  const results = await gbqClient.query(queryString)

  const result = results[0][0]['f0_']

  const expectedTotalRowCount = totalStreams * streamLength
  t.is(result, expectedTotalRowCount)
})
