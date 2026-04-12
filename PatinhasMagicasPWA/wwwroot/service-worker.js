// In development, always fetch from the network and do not enable offline support.
// This is because caching would make development more difficult (changes would not
// be reflected on the first load after each change).
self.addEventListener('fetch', () => { });
self.addEventListener('push', event => event.waitUntil(handlePush(event)));
self.addEventListener('notificationclick', event => event.waitUntil(handleNotificationClick(event)));

const notificationDbName = 'patinhas-magicas-notifications';
const notificationStoreName = 'notifications';

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
    const matchingClient = windowClients.find(client => client.url.includes(self.location.origin));

    if (matchingClient) {
        await matchingClient.focus();
        matchingClient.navigate(targetUrl);
        return;
    }

    await clients.openWindow(targetUrl);
}
