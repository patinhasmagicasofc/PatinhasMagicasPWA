using Microsoft.JSInterop;
using PatinhasMagicasPWA.DTOs;

namespace PatinhasMagicasPWA.Services
{
    public class NotificationInboxService
    {
        private readonly IJSRuntime _jsRuntime;

        public NotificationInboxService(IJSRuntime jsRuntime)
        {
            _jsRuntime = jsRuntime;
        }

        public async Task<List<NotificationInboxItemDTO>> GetAllAsync()
        {
            return await _jsRuntime.InvokeAsync<List<NotificationInboxItemDTO>>("notificationInbox.getAll") ?? new();
        }

        public async Task<int> GetUnreadCountAsync()
        {
            return await _jsRuntime.InvokeAsync<int>("notificationInbox.getUnreadCount");
        }

        public async Task MarkAsReadAsync(string id)
        {
            await _jsRuntime.InvokeVoidAsync("notificationInbox.markAsRead", id);
        }

        public async Task MarkAllAsReadAsync()
        {
            await _jsRuntime.InvokeVoidAsync("notificationInbox.markAllAsRead");
        }

        public async Task RegisterListenerAsync(object dotNetReference)
        {
            await _jsRuntime.InvokeVoidAsync("notificationInbox.registerListener", dotNetReference);
        }

        public async Task UnregisterListenerAsync(object dotNetReference)
        {
            await _jsRuntime.InvokeVoidAsync("notificationInbox.unregisterListener", dotNetReference);
        }
    }
}
