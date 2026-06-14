import { createServer } from 'node:net'

const DEFAULT_HOST = '127.0.0.1'

export async function getSmokePort(rawPort, label = 'smoke', host = DEFAULT_HOST) {
  const port = normalizePort(rawPort, label)

  if (port === 0) return reservePort(host)

  if (!(await canListen(port, host))) {
    throw new Error(`${label} port ${port} is not available`)
  }

  return port
}

function normalizePort(rawPort, label) {
  if (rawPort === undefined || rawPort === '') return 0

  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} port must be an integer between 1 and 65535`)
  }

  return port
}

async function reservePort(host) {
  const server = await listen(0, host)
  const address = server.address()
  await closeServer(server)

  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve OS-assigned smoke port')
  }

  return address.port
}

async function canListen(port, host) {
  try {
    const server = await listen(port, host)
    await closeServer(server)
    return true
  } catch {
    return false
  }
}

function listen(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.once('listening', () => resolve(server))
    server.listen(host ? { port, host } : { port })
  })
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}
