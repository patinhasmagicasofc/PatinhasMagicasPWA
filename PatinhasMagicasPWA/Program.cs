using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using PatinhasMagicasPWA;
using PatinhasMagicasPWA.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped<TokenStorageService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<JwtTokenParserService>();
builder.Services.AddScoped<AuthNavigationService>();
builder.Services.AddScoped<AuthTokenHandler>();

builder.Services.AddScoped(sp =>
{
    var handler = sp.GetRequiredService<AuthTokenHandler>();
    handler.InnerHandler = new HttpClientHandler();
    var configuration = sp.GetRequiredService<IConfiguration>();
    var apiBaseUrl = configuration["ApiBaseUrl"] ?? builder.HostEnvironment.BaseAddress;

    return new HttpClient(handler)
    {
        BaseAddress = new Uri(apiBaseUrl)
    };
});

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UsuarioService>();
builder.Services.AddScoped<ProdutoService>();
builder.Services.AddScoped<AgendamentoService>();
builder.Services.AddScoped<ServicoService>();
builder.Services.AddScoped<AnimalService>();
builder.Services.AddScoped<TamanhoAnimalService>();
builder.Services.AddScoped<EspecieService>();
builder.Services.AddScoped<EnderecoService>();
builder.Services.AddScoped<CepService>();
builder.Services.AddScoped<PushNotificationService>();
builder.Services.AddScoped<DeviceFeedbackService>();
builder.Services.AddScoped<TipoPagamentoService>();
builder.Services.AddScoped<PasskeyAuthService>();


await builder.Build().RunAsync();
