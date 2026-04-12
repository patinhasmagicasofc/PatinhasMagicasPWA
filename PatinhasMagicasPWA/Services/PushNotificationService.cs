using Microsoft.JSInterop;
using PatinhasMagicasPWA.DTOs;
using System.Net.Http.Json;

namespace PatinhasMagicasPWA.Services
{
    public class PushNotificationService
    {
        private readonly HttpClient _http;
        private readonly IJSRuntime _jsRuntime;

        public PushNotificationService(HttpClient http, IJSRuntime jsRuntime)
        {
            _http = http;
            _jsRuntime = jsRuntime;
        }

        public async Task<PushNotificationResultDTO> SubscribeAsync(int usuarioId)
        {
            var publicKeyResponse = await _http.GetFromJsonAsync<PushPublicKeyDTO>("api/push-notifications/vapid-public-key");

            if (string.IsNullOrWhiteSpace(publicKeyResponse?.PublicKey))
            {
                return new PushNotificationResultDTO
                {
                    Success = false,
                    Message = "Nao foi possivel carregar a chave publica das notificacoes."
                };
            }

            var browserSubscription = await _jsRuntime.InvokeAsync<PushSubscriptionDTO?>("pushNotifications.subscribe", publicKeyResponse.PublicKey);

            if (browserSubscription is null)
            {
                return new PushNotificationResultDTO
                {
                    Success = false,
                    Message = "As notificacoes nao foram habilitadas no navegador."
                };
            }

            var response = await _http.PostAsJsonAsync("api/push-notifications/subscriptions", new
            {
                UsuarioId = usuarioId,
                browserSubscription.Endpoint,
                browserSubscription.P256DH,
                browserSubscription.Auth
            });

            return new PushNotificationResultDTO
            {
                Success = response.IsSuccessStatusCode,
                Message = response.IsSuccessStatusCode
                    ? "Notificacoes ativadas com sucesso."
                    : "Nao foi possivel salvar sua inscricao de notificacoes."
            };
        }

        public async Task<PushNotificationResultDTO> SendTestAsync(int usuarioId)
        {
            var response = await _http.PostAsync($"api/push-notifications/test/{usuarioId}", null);

            return new PushNotificationResultDTO
            {
                Success = response.IsSuccessStatusCode,
                Message = response.IsSuccessStatusCode
                    ? "Notificacao de teste enviada."
                    : "Nao foi possivel enviar a notificacao de teste."
            };
        }

        public async Task<bool> IsEnabledAsync()
        {
            return await _jsRuntime.InvokeAsync<bool>("pushNotifications.isEnabled");
        }

        public async Task<PushNotificationResultDTO> DisableAsync()
        {
            var disabled = await _jsRuntime.InvokeAsync<bool>("pushNotifications.unsubscribe");

            return new PushNotificationResultDTO
            {
                Success = disabled,
                Message = disabled
                    ? "Notificacoes desativadas neste dispositivo."
                    : "Nao foi possivel desativar as notificacoes neste dispositivo."
            };
        }
    }
}
