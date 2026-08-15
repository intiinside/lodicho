// Bootstrap + router hash-based minimo. Sin framework, sin build step
// (CLAUDE.md, Frontend): esto es toda la "infraestructura" de navegacion
// que la app necesita.
import { montarTopHeader } from "./components/top-header.js";
import { montarBottomNav } from "./components/bottom-nav.js";
import { aplicarTema, leerTema } from "./state.js";
import * as homeView from "./views/home-view.js";
import * as historialView from "./views/historial-view.js";
import * as resultadoView from "./views/resultado-view.js";
import * as acercaView from "./views/acerca-view.js";

const mainEl = document.getElementById("app-main");
const headerEl = document.getElementById("top-header");
const navEl = document.getElementById("bottom-nav");

function resolverRuta(ruta) {
  if (ruta === "" || ruta === "#" || ruta === "#/") return { vista: homeView, params: {} };
  if (ruta === "#/historial") return { vista: historialView, params: {} };
  if (ruta === "#/acerca") return { vista: acercaView, params: {} };
  // Herramienta interna, no de cara al ciudadano: se carga solo si
  // alguien navega ahi a proposito, nunca en el bundle publico.
  if (ruta === "#/admin") return { cargarVista: () => import("./views/admin-view.js"), params: {} };

  const matchConsulta = ruta.match(/^#\/consulta\/(.+)$/);
  if (matchConsulta) {
    return { vista: resultadoView, params: { id: decodeURIComponent(matchConsulta[1]) } };
  }

  return { vista: homeView, params: {} };
}

async function navegar() {
  const ruta = location.hash || "#/";
  const resuelta = resolverRuta(ruta);
  const vista = resuelta.vista || (await resuelta.cargarVista());
  montarBottomNav(navEl, ruta);
  mainEl.scrollTop = 0;
  await vista.render(mainEl, resuelta.params);
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // La app funciona igual sin SW; el modo offline/instalable es
      // progresivo, no un requisito para que Lo Dicho sirva de algo.
    });
  });
}

function iniciar() {
  aplicarTema(leerTema());
  montarTopHeader(headerEl);
  window.addEventListener("hashchange", navegar);
  navegar();
  registrarServiceWorker();
}

iniciar();
