import { supabase } from "./supabase";

// Chama uma Edge Function do Supabase. `body` é opcional (algumas funções
// não recebem parâmetros). Lança erro se a função falhar.
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(
    name,
    body ? { body } : {}
  );
  if (error) throw error;
  return data;
}

export const fetchKommo = (endpoint) => invoke("kommo", { endpoint });
export const fetchClickup = (endpoint) => invoke("clickup", { endpoint });
export const fetchGoals = () => invoke("goals");
export const fetchTasks = () => invoke("tasks");
export const fetchAvisos = () => invoke("avisos");
export const fetchEventos = () => invoke("eventos");
export const fetchAniversariantes = () => invoke("aniversariantes");
