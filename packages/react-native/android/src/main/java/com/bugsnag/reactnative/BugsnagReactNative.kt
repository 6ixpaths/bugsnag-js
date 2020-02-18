package com.bugsnag.reactnative

import com.bugsnag.android.BreadcrumbType
import com.bugsnag.android.Bugsnag
import com.bugsnag.android.Client
import com.bugsnag.android.InternalHooks
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import java.util.Locale

class BugsnagReactNative(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val configSerializer = ConfigSerializer()
    internal lateinit var internalHooks: InternalHooks
    internal lateinit var client: Client

    private val appSerializer = AppSerializer()
    private val deviceSerializer = DeviceSerializer()
    private val breadcrumbSerializer = BreadcrumbSerializer()
    private val threadSerializer = ThreadSerializer()

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configure(): WritableMap {
        try {
            // see if bugsnag-android is already initalised
            client = Bugsnag.getClient()
            internalHooks = InternalHooks(client)
        } catch (er: IllegalStateException) {
            throw er
        }

        // TODO: I think we also want to return values for state here too:
        // i.e of user, context and metadata
        val map = HashMap<String, Any?>()
        configSerializer.serialize(map, internalHooks.config)
        return map.toWritableMap()
    }

    override fun getName(): String {
        return "BugsnagReactNative"
    }

    @ReactMethod
    fun leaveBreadcrumb(map: ReadableMap) {
        val msg = map.getString("message")!!
        val type = BreadcrumbType.valueOf(map.getString("type")!!.toUpperCase(Locale.US))
        val data = map.getMap("metadata")
        val metadata: Map<String, Any?> = data?.toHashMap() ?: emptyMap()
        client.leaveBreadcrumb(msg, type, metadata)
    }

    @ReactMethod
    fun startSession() = client.startSession()

    @ReactMethod
    fun pauseSession() = client.pauseSession()

    @ReactMethod
    fun resumeSession() {
        client.resumeSession()
    }

    @ReactMethod
    fun updateContext(context: String?) {
        client.context = context
    }

    @ReactMethod
    fun updateMetadata(section: String, data: ReadableMap) {
        client.addMetadata(section, "TODO", "metadata update from js")
    }

    @ReactMethod
    fun updateUser(id: String?, email: String?, name: String?) {
        client.setUser(id, email, name)
    }

    @ReactMethod
    fun dispatch(payload: ReadableMap, promise: Promise) {
        val context = payload.getString("context")
        val groupingHash = payload.getString("groupingHash")
        val unhandled = payload.getBoolean("unhandled")


//        TODO serialize the below

//        errors	Error[]
        val errors = payload.getArray("errors")

//        severity	string
        val severity = payload.getString("severity")

//        severityReason	SeverityReason


//        app	AppWithState
        val app = payload.getMap("app")

//        device	DeviceWithState
        val device = payload.getMap("device")

//        breadcrumbs	Breadcrumb[]
        val breadcrumbs = payload.getArray("breadcrumbs")

//        user User
        val user = payload.getMap("user")

//        metadata	Map<string, MetadataSection>
        val metadata = payload.getMap("metadata")

//        threads	Thread[]
        val threads = payload.getArray("threads")

        client.notify(RuntimeException("TODO")) {
            // TODO modify payload here
            true
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun getPayloadInfo(promise: Promise) {
        val info: WritableMap = WritableNativeMap()

        val app = mutableMapOf<String, Any?>()
        appSerializer.serialize(app, internalHooks.appWithState)
        info.putMap("app", app.toWritableMap())

        val device = mutableMapOf<String, Any?>()
        deviceSerializer.serialize(device, internalHooks.deviceWithState)
        info.putMap("device", device.toWritableMap())

        val crumbs: List<Map<String, Any?>> = internalHooks.breadcrumbs.map {
            val map = mutableMapOf<String, Any?>()
            breadcrumbSerializer.serialize(map, it)
            map
        }
        info.putArray("breadcrumbs", Arguments.makeNativeArray(crumbs))

        val threads: List<Map<String, Any?>> = internalHooks.threads.map {
            val map = mutableMapOf<String, Any?>()
            threadSerializer.serialize(map, it)
            map
        }
        info.putArray("threads", Arguments.makeNativeArray(threads))
        promise.resolve(info)
    }
}
