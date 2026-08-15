import { montarTopHeader } from "./components/top-header.js";
import { montarNavegacion } from "./components/navigation.js";
import { aplicarTema, leerTema } from "./state.js";
import * as homeView from "./views/home-view.js";
import * as historialView from "./views/historial-view.js";
import * as resultadoView from "./views/resultado-view.js";
import * as acercaView from "./views/acerca-view.js";
import * as candidatosView from "./views/candidatos-view.js";
import * as candidatoDetalleView from "./views/candidato-detalle-view.js";

const mainEl = document.getElementById("app-main");
const headerEl = document.getElementById("top-header");
const sidebarEl = document.getElementById("sidebar");
const mobileMenuEl = document.getElementById("mobile-menu");

function resolverRuta(ruta) {
  if (ruta === "" || ruta === "#" || ruta === "#/") return { vista: homeView, params: {} };
  if (ruta === "#/historial") return { vista: historialView, params: {} };
  if (ruta === "#/acerca") return { vista: acercaView, params: {} };
  if (ruta === "#/candidatos") return { vista: candidatosView, params: {} };
  if (ruta === "#/admin") return { cargarVista: () => import("./views/admin-view.js"), params: {} };

  const matchConsulta = ruta.match(/^#\/consulta\/(.+)$/);
  if (matchConsulta) {
    return { vista: resultadoView, params: { id: decodeURIComponent(matchConsulta[1]) } };
  }

  const matchCandidato = ruta.match(/^#\/candidatos\/(.+)$/);
  if (matchCandidato) {
    return { vista: candidatoDetalleView, params: { id: decodeURIComponent(matchCandidato[1]) } };
  }

  return { vista: homeView, params: {} };
}

async function navegar() {
  const ruta = location.hash || "#/";
  const resuelta = resolverRuta(ruta);
  const vista = resuelta.vista || (await resuelta.cargarVista());

  montarNavegacion(sidebarEl, mobileMenuEl, ruta);
  if (mobileMenuEl) mobileMenuEl.dataset.open = "false";

  mainEl.scrollTop = 0;
  await vista.render(mainEl, resuelta.params);
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
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