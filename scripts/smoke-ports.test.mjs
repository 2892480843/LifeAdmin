import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import test from 'node:test'

import { getSmokePort } from './smoke-ports.mjs'

test('smoke port helper uses an OS-assigned port by default', async () => {
  const port = await getSmokePort()

  assert.equal(Number.isInteger(port), true)
  assert.ok(port > 0 && port < 65536)
  await assertCanListen(port)
})

test('smoke port helper rejects an occupied explicit port', async () => {
  const holder = await listenOnFreePort()
  const port = holder.address().port

  try {
    await assert.rejects(() => getSmokePort(String(port), 'agent'), /agent port .* is not available/)
  } finally {
    await closeServer(holder)
  }
})

function assertCanListen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.once('listening', () => closeServer(server).then(resolve, reject))
    server.listen(port, '127.0.0.1')
  })
}

function listenOnFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.once('listening', () => resolve(server))
    server.listen(0, '127.0.0.1')
  })
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}
