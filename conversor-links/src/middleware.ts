import {NextResponse, type NextRequest} from 'next/server';

// Quando o app for pro ar, defina APP_SENHA pra só você abrir (usuário pode ser qualquer um)
export function middleware(req: NextRequest) {
  const senha = process.env.APP_SENHA;
  if (!senha) return NextResponse.next();

  const auth = req.headers.get('authorization') ?? '';
  const [tipo, valor] = auth.split(' ');
  if (tipo === 'Basic' && valor) {
    const [, informada] = atob(valor).split(':');
    if (informada === senha) return NextResponse.next();
  }
  return new NextResponse('Acesso restrito', {
    status: 401,
    headers: {'WWW-Authenticate': 'Basic realm="Conversor de Achadinhos"'},
  });
}

// A API da extensão tem o próprio token, então fica fora da senha
export const config = {matcher: ['/((?!_next/static|_next/image|favicon.ico|api/produtos).*)']};
