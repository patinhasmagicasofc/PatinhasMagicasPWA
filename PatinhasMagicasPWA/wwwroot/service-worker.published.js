// Caution! Be sure you understand the caveats before publishing an application with
// offline support. See https://aka.ms/blazor-offline-considerations

self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));
self.addEventListener('push', event => event.waitUntil(handlePush(event)));
self.addEventListener('notificationclick', event => event.waitUntil(handleNotificationClick(event)));

const notificationDbName = 'patinhas-magicas-notifications';
const notificationStoreName = 'notifications';

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/];
const offlineAssetsExclude = [/^service-worker\.js$/];
const sriOptionalAssets = [/\.(png|jpe?g|gif|ico|webmanifest)$/];

// Replace with your base path if you are hosting on a subfolder. Ensure there is a trailing '/'.
const base = "/";
const baseUrl = new URL(base, self.origin);
const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

function openNotificationDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(notificationDbName, 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(notificationStoreName)) {
                db.createObjectStore(notificationStoreName, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveNotificationInboxItem(item) {
    const db = await openNotificationDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(notificationStoreName, 'readwrite');
        transaction.objectStore(notificationStoreName).put(item);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function markNotificationAsRead(notificationId) {
    const db = await openNotificationDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(notificationStoreName, 'readwrite');
        const store = transaction.objectStore(notificationStoreName);
        const request = store.get(notificationId);

        request.onsuccess = () => {
            const item = request.result;

            if (item) {
                item.isRead = true;
                store.put(item);
            }
        };

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function notifyWindowClients() {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of windowClients) {
        client.postMessage({ type: 'notification-inbox-changed' });
    }
}

async function onInstall(event) {
    console.info('Service worker: Install');

    const assetsToCache = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)));

    const cache = await caches.open(cacheName);

    for (const asset of assetsToCache) {
        try {
            await cache.add(new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
        } catch (error) {
            if (!sriOptionalAssets.some(pattern => pattern.test(asset.url))) {
                throw error;
            }

            console.warn(`Service worker: retrying without integrity for ${asset.url}`, error);
            await cache.add(new Request(asset.url, { cache: 'no-cache' }));
        }
    }
}

async function onActivate(event) {
    console.info('Service worker: Activate');

    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));
}

async function onFetch(event) {
    let cachedResponse = null;
    if (event.request.method === 'GET') {
        const shouldServeIndexHtml = event.request.mode === 'navigate'
            && !manifestUrlList.some(url => url === event.request.url);

        const request = shouldServeIndexHtml ? 'index.html' : event.request;
        const cache = await caches.open(cacheName);
        cachedResponse = await cache.match(request);
    }

    return cachedResponse || fetch(event.request);
}

async function handlePush(event) {
    const payload = event.data ? event.data.json() : {};
    const title = payload.title || 'Patinhas Magicas';
    const notificationId = payload.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const url = payload.url || '/notificacoes';

    await saveNotificationInboxItem({
        id: notificationId,
        title,
        body: payload.body || 'Voce recebeu uma nova notificacao.',
        url,
        receivedAtUtc: new Date().toISOString(),
        isRead: false
    });

    await notifyWindowClients();

    const options = {
        body: payload.body || 'Voce recebeu uma nova notificacao.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: {
            url,
            notificationId
        }
    };

    await self.registration.showNotification(title, options);
}

async function handleNotificationClick(event) {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/notificacoes';
    const notificationId = event.notification.data?.notificationId;

    if (notificationId) {
        await markNotificationAsRead(notificationId);
        await notifyWindowClients();
    }

    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const matchingClient = windowClients.find(client => client.url.startsWith(self.location.origin));

    if (matchingClient) {
        await matchingClient.focus();
        matchingClient.navigate(targetUrl);
        return;
    }

    await clients.openWindow(targetUrl);
}
