import { jest } from "@jest/globals";
import { apiFetch, apiGet, apiPost, apiPostVoid, apiPatch, apiPostForm, apiDelete, apiDownloadCSV } from "../../frontend/src/lib/api";

describe("apiFetch", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("ajoute le prefixe /api et credentials include", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    await apiFetch("/comptes");

    expect(fetch).toHaveBeenCalledWith(
      "/api/comptes",
      expect.objectContaining({
        credentials: "include",
      })
    );
  });

  it("convertit le body en JSON", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    await apiFetch("/auth/login", {
      method: "POST",
      body: { email: "user@Leon.local" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        body: JSON.stringify({ email: "user@Leon.local" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("leve une erreur normalisee si la reponse n'est pas OK", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => JSON.stringify({ message: "Non autorise" }),
    });

    await expect(apiFetch("/auth/me")).rejects.toEqual({
      status: 401,
      message: "Non autorise",
    });
  });

  it("utilise le statusText si le body ne contient pas de message", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({}),
    });

    await expect(apiFetch("/comptes")).rejects.toEqual({
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("utilise 'Erreur' par defaut si ni message ni statusText", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "",
      text: async () => "",
    });

    await expect(apiFetch("/comptes")).rejects.toMatchObject({
      status: 503,
      message: "Erreur",
    });
  });

  it("retourne undefined si la reponse est vide et ok", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    const result = await apiFetch("/auth/logout");
    expect(result).toBeUndefined();
  });

  it("n'ajoute pas Content-Type si le body est absent", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: [] }),
    });

    await apiFetch("/comptes");

    const callArgs = fetch.mock.calls[0][1];
    expect(callArgs.headers?.["Content-Type"]).toBeUndefined();
  });

  it("passe le body sous forme de chaine si c'est deja une string", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    await apiFetch("/test", { method: "POST", body: '{"raw":true}' });

    const callArgs = fetch.mock.calls[0][1];
    expect(callArgs.body).toBe('{"raw":true}');
  });

  it("ajoute le prefixe / si le chemin ne commence pas par /", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    await apiFetch("comptes");

    expect(fetch).toHaveBeenCalledWith("/api/comptes", expect.anything());
  });
});

describe("apiGet", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("effectue un GET sur le chemin donne", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: [{ id: 1 }] }),
    });

    const result = await apiGet("/comptes");

    expect(fetch).toHaveBeenCalledWith("/api/comptes", expect.objectContaining({ credentials: "include" }));
    expect(result).toEqual({ data: [{ id: 1 }] });
  });
});

describe("apiPost", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("effectue un POST avec le body fourni", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: "OK", id: 5 }),
    });

    const result = await apiPost("/virements", { montant: 100 });

    expect(fetch).toHaveBeenCalledWith(
      "/api/virements",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ montant: 100 }),
      })
    );
    expect(result).toEqual({ message: "OK", id: 5 });
  });
});

describe("apiPostVoid", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("effectue un POST et ne retourne rien", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    const result = await apiPostVoid("/auth/logout", {});

    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toBeUndefined();
  });
});

describe("apiPatch", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("effectue un PATCH avec le body fourni", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: "Carte bloquee" }),
    });

    const result = await apiPatch("/cartes/1/bloquer", { statut: "BLOQUEE" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/cartes/1/bloquer",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(result).toEqual({ message: "Carte bloquee" });
  });

  it("effectue un PATCH sans body", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: "OK" }),
    });

    await apiPatch("/cartes/1/bloquer");

    const callArgs = fetch.mock.calls[0][1];
    expect(callArgs.method).toBe("PATCH");
    expect(callArgs.body).toBeUndefined();
  });
});

describe("apiDelete", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("effectue un DELETE sur le chemin donne", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: "Supprimé" }),
    });

    const result = await apiDelete("/admin/utilisateurs/5");

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/utilisateurs/5",
      expect.objectContaining({ method: "DELETE", credentials: "include" })
    );
    expect(result).toEqual({ message: "Supprimé" });
  });

  it("lève une erreur si la réponse n'est pas OK", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ message: "Introuvable" }),
    });

    await expect(apiDelete("/admin/utilisateurs/999")).rejects.toMatchObject({
      status: 404,
      message: "Introuvable",
    });
  });
});

describe("apiDownloadCSV", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    global.URL.createObjectURL = jest.fn().mockReturnValue("blob:fake-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("télécharge un fichier CSV et crée un lien ancre", async () => {
    const fakeBlob = new Blob(["id,email"], { type: "text/csv" });
    fetch.mockResolvedValue({
      ok: true,
      blob: async () => fakeBlob,
    });

    const appendSpy = jest.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    const removeSpy = jest.spyOn(document.body, "removeChild").mockImplementation(() => {});
    const clickSpy  = jest.fn();
    jest.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    });

    await apiDownloadCSV("/export/audit", "audit.csv");

    expect(fetch).toHaveBeenCalledWith("/api/export/audit", { credentials: "include" });
    expect(URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("lève une erreur si la réponse n'est pas OK", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Accès refusé" }),
    });

    await expect(apiDownloadCSV("/export/audit", "audit.csv")).rejects.toMatchObject({
      status: 403,
      message: "Accès refusé",
    });
  });

  it("ajoute le préfixe / si le chemin ne commence pas par / (ligne 156 false branch)", async () => {
    const fakeBlob = new Blob(["id,email"], { type: "text/csv" });
    fetch.mockResolvedValue({
      ok: true,
      blob: async () => fakeBlob,
    });

    const appendSpy = jest.spyOn(document.body, "appendChild").mockImplementation((el) => el);
    const removeSpy = jest.spyOn(document.body, "removeChild").mockImplementation(() => {});
    jest.spyOn(document, "createElement").mockReturnValue({ href: "", download: "", click: jest.fn() });

    await apiDownloadCSV("export/audit", "audit.csv"); // pas de / au début

    expect(fetch).toHaveBeenCalledWith("/api/export/audit", { credentials: "include" });

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("utilise 'Erreur export' si l'erreur n'a pas de message (ligne 162 fallback)", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({}), // pas de message
    });

    await expect(apiDownloadCSV("/export/audit", "audit.csv")).rejects.toMatchObject({
      status: 500,
      message: "Erreur export",
    });
  });
});

describe("apiPostForm", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("envoie un FormData sans Content-Type JSON", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: "Depot cree", id: 42 }),
    });

    const formData = new FormData();
    formData.append("montant", "500");

    const result = await apiPostForm("/depots", formData);

    expect(fetch).toHaveBeenCalledWith(
      "/api/depots",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: formData,
      })
    );
    expect(result).toEqual({ message: "Depot cree", id: 42 });
  });

  it("leve une erreur si la reponse n'est pas OK", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ message: "Montant invalide" }),
    });

    const formData = new FormData();

    await expect(apiPostForm("/depots", formData)).rejects.toMatchObject({
      status: 400,
      message: "Montant invalide",
    });
  });

  it("utilise le statusText si pas de message dans la reponse d'erreur", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      text: async () => "",
    });

    await expect(apiPostForm("/depots", new FormData())).rejects.toMatchObject({
      status: 500,
      message: "Server Error",
    });
  });

  it("utilise 'Erreur' si ni message ni statusText (ligne 202 fallback)", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "",
      text: async () => "",
    });

    await expect(apiPostForm("/depots", new FormData())).rejects.toMatchObject({
      status: 503,
      message: "Erreur",
    });
  });

  it("ajoute le préfixe / si le chemin ne commence pas par / (ligne 190 false branch)", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message: "OK" }),
    });

    await apiPostForm("depots", new FormData()); // pas de / au début

    expect(fetch).toHaveBeenCalledWith("/api/depots", expect.anything());
  });
});
