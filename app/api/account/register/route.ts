export async function POST() {
  return Response.json(
    { error: "El registro con contraseña fue reemplazado por el acceso seguro con Google." },
    { status: 410 },
  );
}
