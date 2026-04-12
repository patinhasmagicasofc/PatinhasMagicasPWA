namespace PatinhasMagicasPWA.DTOs
{
    public class NotificationInboxItemDTO
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Url { get; set; } = "/";
        public DateTime ReceivedAtUtc { get; set; }
        public bool IsRead { get; set; }
    }
}
