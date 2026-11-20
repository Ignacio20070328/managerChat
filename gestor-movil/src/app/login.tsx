import { PantallaLogin } from '@/components/pantalla-login';
import { useSesion } from '@/lib/contexto-sesion';

export default function Login() {
  const { ingresar, aviso } = useSesion();
  return <PantallaLogin alIngresar={ingresar} aviso={aviso} />;
}
