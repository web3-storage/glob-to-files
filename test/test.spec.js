import test from 'ava'
import Path from 'path'
import process from 'process'
import os from 'os'
import fs from 'fs'
import crypto from 'crypto'
import unlimited from 'unlimited'
import { filesFromPath, getFilesFromPath } from '../src/index.js'

test('yields files from fixtures folder', async t => {
  const files = []
  for await (const f of filesFromPath(`${process.cwd()}/test/fixtures`)) {
    files.push(f)
  }

  t.true(files.length === 2)
})

test('gets files from fixtures folder', async t => {
  const files = await getFilesFromPath(`${process.cwd()}/test/fixtures`)

  t.true(files.length === 2)
})

test('removes custom prefix', async t => {
  const files = await getFilesFromPath(`${process.cwd()}/test/fixtures`)

  const pathPrefix = Path.join(process.cwd(), 'test', 'fixtures')
  const filesWithoutPrefix = await getFilesFromPath(`${process.cwd()}/test/fixtures`, { pathPrefix })

  files.forEach(f => {
    t.true(f.name.includes('fixtures'))
  })

  filesWithoutPrefix.forEach(f => {
    t.false(f.name.includes('fixtures'))
  })
})

test('allows read of more files than ulimit maxfiles', async t => {
  let dir
  try {
    console.log('Generating test data...')
    dir = await generateTestData()
    console.log('Done generating test data!')
    unlimited(256)
    let totalFiles = 0
    let totalBytes = 0
    const readPromises = []
    for await (const f of filesFromPath(dir)) {
      readPromises.push((async () => {
        totalFiles++
        let i = 0
        for await (const d of f.stream()) {
          if (i === 0) { // make slow so we open loads of files
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          totalBytes += d.length
          i++
        }
      })())
    }
    await Promise.all(readPromises)
    t.is(totalFiles > 0, true)
    t.is(totalBytes > 0, true)
  } finally {
    if (dir) {
      await fs.promises.rm(dir, { recursive: true, force: true })
    }
  }
})

async function generateTestData () {
  const dirName = Path.join(os.tmpdir(), `files-from-path-test-${Date.now()}`)
  await fs.promises.mkdir(dirName)
  const minBytes = 1024
  const maxBytes = 1024 * 1024 * 5
  for (let i = 0; i < 10750; i++) {
    const numBytes = Math.floor(Math.random() * (maxBytes - minBytes) + minBytes)
    await fs.promises.writeFile(Path.join(dirName, `${i}.json`), crypto.randomBytes(numBytes))
  }
  return dirName
}
