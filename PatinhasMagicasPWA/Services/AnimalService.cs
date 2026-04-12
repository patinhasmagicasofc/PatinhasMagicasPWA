using Microsoft.JSInterop;
using PatinhasMagicasPWA.DTOs;
using System.Net.Http.Json;
using System.Text.Json;

namespace PatinhasMagicasPWA.Services
{
    public class AnimalService
    {
        private const string AnimalOptionsCacheKey = "animal-select-options";

        private readonly HttpClient _http;
        private readonly IJSRuntime _jsRuntime;
        private Task<List<AnimalDTO>>? _animalsTask;
        private List<AnimalDTO>? _animalsCache;
        private List<AnimalSelectOptionDTO>? _animalOptionsCache;
        private bool _animalOptionsLoadedFromStorage;

        public AnimalService(HttpClient http, IJSRuntime jsRuntime)
        {
            _http = http;
            _jsRuntime = jsRuntime;
        }

        public async Task<List<AnimalDTO>> GetAllAnimalsAsync(bool forceRefresh = false)
        {
            if (!forceRefresh)
            {
                if (_animalsCache is not null)
                {
                    return new List<AnimalDTO>(_animalsCache);
                }

                if (_animalsTask is not null)
                {
                    var cachedAnimals = await _animalsTask;
                    return new List<AnimalDTO>(cachedAnimals);
                }
            }

            _animalsTask = LoadAnimalsAsync();

            try
            {
                var animals = await _animalsTask;
                _animalsCache = animals;

                return new List<AnimalDTO>(animals);
            }
            finally
            {
                _animalsTask = null;
            }
        }

        public async Task<List<AnimalSelectOptionDTO>> GetCachedAnimalOptionsAsync()
        {
            if (_animalOptionsCache is not null)
            {
                return CloneAnimalOptions(_animalOptionsCache);
            }

            if (_animalOptionsLoadedFromStorage)
            {
                return new List<AnimalSelectOptionDTO>();
            }

            _animalOptionsLoadedFromStorage = true;

            try
            {
                var json = await _jsRuntime.InvokeAsync<string?>("localStorage.getItem", AnimalOptionsCacheKey);
                if (string.IsNullOrWhiteSpace(json))
                {
                    return new List<AnimalSelectOptionDTO>();
                }

                _animalOptionsCache = JsonSerializer.Deserialize<List<AnimalSelectOptionDTO>>(json) ?? new List<AnimalSelectOptionDTO>();
                return CloneAnimalOptions(_animalOptionsCache);
            }
            catch
            {
                return new List<AnimalSelectOptionDTO>();
            }
        }

        public async Task<List<AnimalSelectOptionDTO>> GetAnimalOptionsAsync(bool forceRefresh = false)
        {
            if (!forceRefresh)
            {
                if (_animalOptionsCache is not null)
                {
                    return CloneAnimalOptions(_animalOptionsCache);
                }

                var cachedOptions = await GetCachedAnimalOptionsAsync();
                if (cachedOptions.Count > 0)
                {
                    return cachedOptions;
                }
            }

            var animals = await GetAllAnimalsAsync(forceRefresh);
            var options = animals
                .Select(animal => new AnimalSelectOptionDTO
                {
                    Id = animal.Id,
                    Nome = animal.Nome,
                    NomeEspecie = animal.NomeEspecie,
                    NomeTamanhoAnimal = animal.NomeTamanhoAnimal
                })
                .OrderBy(animal => animal.Nome)
                .ToList();

            _animalOptionsCache = options;
            await PersistAnimalOptionsCacheAsync(options);

            return CloneAnimalOptions(options);
        }

        public async Task<bool> Cadastrar(AnimalDTO animal)
        {
            var response = await _http.PostAsJsonAsync("api/animal", animal);

            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var content = await response.Content.ReadAsStringAsync();
            await InvalidateAnimalsCacheAsync();

            return true;
        }

        public async Task<bool> Editar(AnimalDTO animal)
        {
            var response = await _http.PutAsJsonAsync($"api/animal/{animal.Id}", animal);
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var content = await response.Content.ReadAsStringAsync();
            await InvalidateAnimalsCacheAsync();
            return true;
        }

        public async Task<bool> Delete(AnimalDTO animal)
        {
            var response = await _http.DeleteAsync($"api/animal/{animal.Id}");
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var content = await response.Content.ReadAsStringAsync();
            await InvalidateAnimalsCacheAsync();
            return true;
        }

        public async Task<AnimalDTO> GetById(int id)
        {
            var response = await _http.GetFromJsonAsync<AnimalDTO>($"api/animal/{id}");
            return response;
        }

        private static List<AnimalSelectOptionDTO> CloneAnimalOptions(List<AnimalSelectOptionDTO> options)
        {
            return options
                .Select(animal => new AnimalSelectOptionDTO
                {
                    Id = animal.Id,
                    Nome = animal.Nome,
                    NomeEspecie = animal.NomeEspecie,
                    NomeTamanhoAnimal = animal.NomeTamanhoAnimal
                })
                .ToList();
        }

        private async Task<List<AnimalDTO>> LoadAnimalsAsync()
        {
            var response = await _http.GetFromJsonAsync<List<AnimalDTO>>("api/animal/meus");
            return response ?? new List<AnimalDTO>();
        }

        private async Task PersistAnimalOptionsCacheAsync(List<AnimalSelectOptionDTO> options)
        {
            try
            {
                var json = JsonSerializer.Serialize(options);
                await _jsRuntime.InvokeVoidAsync("localStorage.setItem", AnimalOptionsCacheKey, json);
            }
            catch
            {
            }
        }

        private async Task InvalidateAnimalsCacheAsync()
        {
            _animalsCache = null;
            _animalsTask = null;
            _animalOptionsCache = null;
            _animalOptionsLoadedFromStorage = false;

            try
            {
                await _jsRuntime.InvokeVoidAsync("localStorage.removeItem", AnimalOptionsCacheKey);
            }
            catch
            {
            }
        }
    }
}
