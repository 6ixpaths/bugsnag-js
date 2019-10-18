const { describe, it, expect } = global

const plugin = require('../device')

const Client = require('@bugsnag/core/client')
const schema = {
  ...require('@bugsnag/core/config').schema,
  hostname: {
    defaultValue: () => 'test-machine.local',
    validate: () => true,
    message: 'should be a string'
  }
}
const VALID_NOTIFIER = { name: 't', version: '0', url: 'http://' }
const ISO_8601 = /^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?$/i

describe('plugin: node device', () => {
  it('should set device = { hostname, runtimeVersions } add a beforeSend callback which adds device time', done => {
    const client = new Client({ apiKey: 'API_KEY_YEAH' }, schema, VALID_NOTIFIER)
    client.use(plugin)

    expect(client._callbacks.onError.length).toBe(1)

    client._delivery(client => ({
      sendEvent: (payload) => {
        expect(payload.events[0].device).toBeDefined()
        expect(payload.events[0].device.time).toMatch(ISO_8601)
        done()
      }
    }))
    client.notify(new Error('noooo'), event => {
      expect(event.device.hostname).toBe('test-machine.local')
      expect(event.device.runtimeVersions).toBeDefined()
      expect(event.device.runtimeVersions.node).toEqual(process.versions.node)
    })
  })
})
