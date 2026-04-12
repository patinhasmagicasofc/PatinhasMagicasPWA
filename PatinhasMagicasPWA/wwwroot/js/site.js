window.aplicarMascaraCPF = (elementOrId) => {
    const element = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (!element) {
        return;
    }

    IMask(element, {
        mask: '000.000.000-00'
    });
};

window.pushNotifications = {
    async subscribe(vapidPublicKey) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return null;
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });
        }

        const subscriptionJson = subscription.toJSON();

        return {
            endpoint: subscription.endpoint,
            p256DH: subscriptionJson.keys?.p256dh ?? '',
            auth: subscriptionJson.keys?.auth ?? ''
        };
    },

    async isEnabled() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }

        if (Notification.permission !== 'granted') {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    },

    async unsubscribe() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            return true;
        }

        return await subscription.unsubscribe();
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let index = 0; index < rawData.length; ++index) {
            outputArray[index] = rawData.charCodeAt(index);
        }

        return outputArray;
    }
};

window.notificationInbox = (() => {
    const dbName = 'patinhas-magicas-notifications';
    const storeName = 'notifications';
    const listeners = [];

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function getAll() {
        const db = await openDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const items = (request.result || [])
                    .sort((left, right) => new Date(right.receivedAtUtc) - new Date(left.receivedAtUtc));

                db.close();
                resolve(items);
            };

            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    }

    async function save(item) {
        const db = await openDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            transaction.objectStore(storeName).put(item);

            transaction.oncomplete = async () => {
                db.close();
                await notifyListeners();
                resolve();
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    }

    async function markAsRead(id) {
        const db = await openDb();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                const item = request.result;

                if (item) {
                    item.isRead = true;
                    store.put(item);
                }
            };

            transaction.oncomplete = async () => {
                db.close();
                await notifyListeners();
                resolve();
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    }

    async function markAllAsRead() {
        const items = await getAll();

        for (const item of items) {
            if (!item.isRead) {
                await markAsRead(item.id);
            }
        }

        await notifyListeners();
    }

    async function getUnreadCount() {
        const items = await getAll();
        return items.filter(item => !item.isRead).length;
    }

    async function notifyListeners() {
        const activeListeners = [...listeners];

        for (const listener of activeListeners) {
            try {
                await listener.invokeMethodAsync('HandleNotificationInboxChanged');
            } catch (error) {
                const index = listeners.indexOf(listener);
                if (index >= 0) {
                    listeners.splice(index, 1);
                }
            }
        }
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type === 'notification-inbox-changed') {
                notifyListeners();
            }
        });
    }

    return {
        getAll,
        getUnreadCount,
        save,
        markAsRead,
        markAllAsRead,
        registerListener(dotNetRef) {
            listeners.push(dotNetRef);
        },
        unregisterListener(dotNetRef) {
            const index = listeners.indexOf(dotNetRef);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    };
})();

window.deviceFeedback = {
    storageKey: 'device-feedback-enabled',

    isSupported() {
        try {
            return 'vibrate' in navigator;
        } catch (e) {
            console.debug('deviceFeedback.isSupported error', e);
            return false;
        }
    },

    isEnabled() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored === null ? true : stored === 'true';
        } catch (e) {
            console.debug('deviceFeedback.isEnabled error', e);
            return true;
        }
    },

    setEnabled(enabled) {
        try {
            localStorage.setItem(this.storageKey, enabled ? 'true' : 'false');
        } catch (e) {
            console.debug('deviceFeedback.setEnabled error', e);
        }
    },

    vibrate(pattern) {
        try {
            if (!('vibrate' in navigator)) {
                console.debug('Vibrate not supported by navigator');
                return;
            }

            if (!this.isEnabled()) {
                return;
            }

            console.debug('Calling navigator.vibrate with pattern', pattern);
            navigator.vibrate(pattern);
        } catch (e) {
            console.debug('deviceFeedback.vibrate error', e);
        }
    }
};

window.navigationHelper = {
    goBackOrHome(fallbackUrl) {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        window.location.assign(fallbackUrl || '/home');
    }
};

window.passkeys = {
    isSupported() {
        return !!(window.PublicKeyCredential && navigator.credentials);
    },

    async createCredential(publicKey) {
        if (!this.isSupported()) {
            throw new Error('Passkeys nao suportadas neste navegador.');
        }

        const options = this.mapCreationOptions(publicKey);
        const credential = await navigator.credentials.create({ publicKey: options });

        if (!credential) {
            throw new Error('Nao foi possivel criar a credencial biometrica.');
        }

        return this.serializeCredential(credential);
    },

    async getCredential(publicKey) {
        if (!this.isSupported()) {
            throw new Error('Passkeys nao suportadas neste navegador.');
        }

        const options = this.mapRequestOptions(publicKey);
        const credential = await navigator.credentials.get({ publicKey: options });

        if (!credential) {
            throw new Error('Nao foi possivel obter a credencial biometrica.');
        }

        return this.serializeCredential(credential);
    },

    mapCreationOptions(publicKey) {
        return {
            ...publicKey,
            challenge: this.base64UrlToBuffer(publicKey.challenge),
            user: {
                ...publicKey.user,
                id: this.base64UrlToBuffer(publicKey.user.id)
            },
            excludeCredentials: (publicKey.excludeCredentials || []).map(item => ({
                ...item,
                id: this.base64UrlToBuffer(item.id)
            }))
        };
    },

    mapRequestOptions(publicKey) {
        return {
            ...publicKey,
            challenge: this.base64UrlToBuffer(publicKey.challenge),
            allowCredentials: (publicKey.allowCredentials || []).map(item => ({
                ...item,
                id: this.base64UrlToBuffer(item.id)
            }))
        };
    },

    serializeCredential(credential) {
        return {
            id: credential.id,
            rawId: this.bufferToBase64Url(credential.rawId),
            type: credential.type,
            response: {
                clientDataJSON: this.bufferToBase64Url(credential.response.clientDataJSON),
                attestationObject: credential.response.attestationObject
                    ? this.bufferToBase64Url(credential.response.attestationObject)
                    : undefined,
                authenticatorData: credential.response.authenticatorData
                    ? this.bufferToBase64Url(credential.response.authenticatorData)
                    : undefined,
                signature: credential.response.signature
                    ? this.bufferToBase64Url(credential.response.signature)
                    : undefined,
                userHandle: credential.response.userHandle
                    ? this.bufferToBase64Url(credential.response.userHandle)
                    : undefined,
                transports: typeof credential.response.getTransports === 'function'
                    ? credential.response.getTransports()
                    : undefined
            },
            clientExtensionResults: typeof credential.getClientExtensionResults === 'function'
                ? credential.getClientExtensionResults()
                : {}
        };
    },

    bufferToBase64Url(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';

        for (let i = 0; i < bytes.byteLength; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }

        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    },

    base64UrlToBuffer(value) {
        const padding = '='.repeat((4 - (value.length % 4)) % 4);
        const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes.buffer;
    }
};
