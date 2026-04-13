using PatinhasMagicasPWA.DTOs;
using System.Net.Http.Json;
using System.Text.Json;

namespace PatinhasMagicasPWA.Services
{
    public class UsuarioService
    {
        private readonly HttpClient _http;
        private readonly TokenStorageService _tokenStorageService;

        public UsuarioService(HttpClient http, TokenStorageService tokenStorageService)
        {
            _http = http;
            _tokenStorageService = tokenStorageService;
        }

        private async Task<UsuarioDTO> MapCadastroUsuarioToUsuario(CadastroUsuarioDTO cadastroUsuario)
        {
            return new UsuarioDTO
            {
                Nome = cadastroUsuario.Nome!,
                CPF = cadastroUsuario.CPF!,
                Email = cadastroUsuario.Email!,
                Senha = cadastroUsuario.Senha!,
                Ddd = cadastroUsuario.Ddd!.Value,
                Telefone = cadastroUsuario.Telefone!,
                Ativo = true,
                TipoUsuarioId = null
            };
        }

        public async Task<OperationResultDTO> Cadastrar(CadastroUsuarioDTO cadastroUsuario)
        {
            var usuario = await MapCadastroUsuarioToUsuario(cadastroUsuario);

            try
            {
                var response = await _http.PostAsJsonAsync("api/usuario", usuario);
                var content = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return new OperationResultDTO
                    {
                        Success = false,
                        Message = AuthService.ExtractErrorMessage(content)
                    };
                }

                return new OperationResultDTO
                {
                    Success = true
                };
            }
            catch
            {
                return new OperationResultDTO
                {
                    Success = false,
                    Message = "Erro ao conectar com a API."
                };
            }
        }


        public async Task<UsuarioOutputDTO?> GetByIdAsync(int id)
        {
            var response = await _http.GetAsync($"api/usuario/{id}");

            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            return await response.Content.ReadFromJsonAsync<UsuarioOutputDTO>();
        }

        public async Task<bool> UpdateAsync(int id, UsuarioOutputDTO usuario)
        {
            var updatePayload = new
            {
                usuario.Nome,
                usuario.Email,
                usuario.Ddd,
                usuario.Telefone,
                usuario.TipoUsuarioId,
                usuario.Ativo
            };

            var response = await _http.PutAsJsonAsync($"api/usuario/{id}", updatePayload);
            return response.IsSuccessStatusCode;
        }
    }
}
