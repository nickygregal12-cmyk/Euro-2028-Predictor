import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 10,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
}

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')

export default function () {
  const home = http.get(`${baseUrl}/`)
  check(home, {
    'home returns 200': (response) => response.status === 200,
    'home is html': (response) => response.headers['Content-Type']?.includes('text/html') === true,
  })

  const release = http.get(`${baseUrl}/release.json`)
  check(release, {
    'release metadata returns 200': (response) => response.status === 200,
    'release metadata is json': (response) => response.headers['Content-Type']?.includes('application/json') === true,
  })

  const robots = http.get(`${baseUrl}/robots.txt`)
  check(robots, {
    'robots returns 200': (response) => response.status === 200,
  })

  sleep(0.5)
}
