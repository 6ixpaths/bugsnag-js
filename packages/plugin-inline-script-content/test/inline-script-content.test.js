const { describe, it, expect, spyOn } = global

const plugin = require('../')

const Client = require('@bugsnag/core/client')
const Event = require('@bugsnag/core/event')
const VALID_NOTIFIER = { name: 't', version: '0', url: 'http://' }

describe('plugin: inline script content', () => {
  it('should add a beforeSend callback which captures the HTML content if file=current url', done => {
    const scriptContent = `function BadThing() {
  Error.apply(this, args)
}
BadThing.prototype = Object.create(Error.prototype)
bugsnagClient.notify(new BadThing('Happens in script tags'))`
    const document = {
      scripts: [{ innerHTML: scriptContent }],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    const payloads = []
    client.use(plugin, document, window)

    expect(client._callbacks.onError.length).toBe(1)
    client._delivery(client => ({
      sendEvent: (payload, cb) => {
        payloads.push(payload)
        cb()
      }
    }))
    client._notify(new Event('BadThing', 'Happens in script tags', [
      { fileName: window.location.href, lineNumber: 10 }
    ]), () => {}, () => {
      expect(payloads.length).toEqual(1)
      expect(payloads[0].events[0].errors[0].stacktrace[0].code).toBeDefined()
      expect(payloads[0].events[0]._metadata.script).toBeDefined()
      expect(payloads[0].events[0]._metadata.script.content).toEqual(scriptContent)
      done()
    })
  })

  it('calls the previous onreadystatechange handler if it exists', done => {
    const prevHandler = () => { done() }
    const document = { documentElement: { outerHTML: '' }, onreadystatechange: prevHandler }
    const window = { location: { href: 'https://app.bugsnag.com/errors' }, document }
    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    client.use(plugin, document, window)
    // check it installed a new onreadystatechange handler
    expect(document.onreadystatechange === prevHandler).toBe(false)
    // now check it calls the previous one
    document.onreadystatechange()
  })

  it('does no wrapping of global functions when disabled', () => {
    const document = { documentElement: { outerHTML: '' } }
    const addEventListener = function () {}
    const window = { location: { href: 'https://app.bugsnag.com/errors' }, document }
    function EventTarget () {}
    EventTarget.prototype.addEventListener = addEventListener
    window.EventTarget = EventTarget
    const client = new Client({ apiKey: 'API_KEY_YEAH', trackInlineScripts: false }, undefined, VALID_NOTIFIER)
    client.use(plugin, document, window)
    // check the addEventListener function was not wrapped
    expect(window.EventTarget.prototype.addEventListener).toBe(addEventListener)
  })

  it('truncates script content to a reasonable length', done => {
    let scriptContent = ''
    for (let i = 0; i < 10000; i++) {
      scriptContent += `function fn_${i} (arg0, arg1, arg2) {\n`
      scriptContent += '  console.log(\'this is an awfully long inline script!\')\n'
      scriptContent += '}\n'
    }
    expect(scriptContent.length > 500000).toBe(true)
    const document = {
      scripts: [{ innerHTML: scriptContent }],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    const payloads = []
    client.use(plugin, document, window)

    expect(client._callbacks.onError.length).toBe(1)
    client._delivery(client => ({
      sendEvent: (payload, cb) => {
        payloads.push(payload)
        cb()
      }
    }))
    client._notify(new Event('BadThing', 'Happens in script tags', [
      { fileName: window.location.href, lineNumber: 10 }
    ]), () => {}, () => {
      expect(payloads.length).toEqual(1)
      expect(payloads[0].events[0].errors[0].stacktrace[0].code).toBeDefined()
      expect(payloads[0].events[0]._metadata.script).toBeDefined()
      expect(payloads[0].events[0]._metadata.script.content.length).toBe(500000)
      done()
    })
  })

  it('truncates surrounding code lines to a reasonable length', done => {
    const longMessage = Array(1000).fill('jim').join(',')
    const scriptContent = `function fn (arg0, arg1, arg2) {
  console.log('${longMessage}')
}`
    expect(longMessage.length > 200).toBe(true)
    const document = {
      scripts: [{ innerHTML: scriptContent }],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    const payloads = []
    client.use(plugin, document, window)

    expect(client._callbacks.onError.length).toBe(1)
    client._delivery(client => ({
      sendEvent: (payload, cb) => {
        payloads.push(payload)
        cb()
      }
    }))
    client._notify(new Event('BadThing', 'Happens in script tags', [
      { fileName: window.location.href, lineNumber: 7 }
    ]), () => {}, () => {
      expect(payloads.length).toEqual(1)
      expect(payloads[0].events[0].errors[0].stacktrace[0].code).toBeDefined()
      const surroundingCode = payloads[0].events[0].errors[0].stacktrace[0].code
      Object.keys(surroundingCode).forEach(line => {
        expect(surroundingCode[line].length > 200).toBe(false)
      })
      expect(payloads[0].events[0]._metadata.script).toBeDefined()
      done()
    })
  })

  it('works when the stacktrace is empty', done => {
    const scriptContent = 'console.log("EMPTY")'
    const document = {
      scripts: [{ innerHTML: scriptContent }],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    const payloads = []
    client.use(plugin, document, window)

    expect(client._callbacks.onError.length).toBe(1)
    client._delivery(client => ({
      sendEvent: (payload, cb) => {
        payloads.push(payload)
        cb()
      }
    }))
    const spy = spyOn(client.__logger, 'error')
    client._notify(new Event('EmptyStacktrace', 'Has nothing in it', []), () => {}, () => {
      expect(payloads.length).toEqual(1)
      expect(payloads[0].events[0].errors[0].stacktrace).toEqual([])
      expect(spy).toHaveBeenCalledTimes(0)
      done()
    })
  })

  it('calls removeEventListener with wrapped and unwrapped callback', () => {
    const scriptContent = 'console.log("unwrapped")'
    const document = {
      scripts: [{ innerHTML: scriptContent }],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<p>
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
Lorem ipsum dolor sit amet.
</p>
<script>${scriptContent}
</script>
<p>more content</p>`
      }
    }
    function Window () {}
    Window.prototype = {
      addEventListener: function () {},
      removeEventListener: function () {}
    }
    const window = {
      location: { href: 'https://app.bugsnag.com/errors' }
    }

    Object.setPrototypeOf(window, Window.prototype)
    window.Window = Window

    function myfun () {}
    window.addEventListener('click', myfun)

    const spy = spyOn(Window.prototype, 'removeEventListener')
    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    client.use(plugin, document, window)

    window.removeEventListener('click', myfun)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('gets the correct line numbers for errors at the start of the document', done => {
    const scriptContent = 'throw new Error(\'oh\')\nconsole.log(\'next\')'
    const document = {
      scripts: [{ innerHTML: scriptContent }],
      currentScript: { innerHTML: scriptContent },
      documentElement: {
        outerHTML: `<script>${scriptContent}</script>`
      }
    }
    const window = { location: { href: 'https://app.bugsnag.com/errors' } }

    const client = new Client({ apiKey: 'API_KEY_YEAH' }, undefined, VALID_NOTIFIER)
    const payloads = []
    client.use(plugin, document, window)

    expect(client._callbacks.onError.length).toBe(1)
    client._delivery(client => ({
      sendEvent: (payload, cb) => {
        payloads.push(payload)
        cb()
      }
    }))
    client._notify(new Event('Error', 'oh', [
      { fileName: window.location.href, lineNumber: 1 }
    ]), () => {}, () => {
      expect(payloads.length).toEqual(1)
      expect(payloads[0].events[0].errors[0].stacktrace[0].code).toEqual({
        1: '<!-- DOC START -->',
        2: '<script>throw new Error(\'oh\')',
        3: 'console.log(\'next\')</script>'
      })
      expect(payloads[0].events[0]._metadata.script).toBeDefined()
      expect(payloads[0].events[0]._metadata.script.content).toEqual(scriptContent)
      done()
    })
  })
})
