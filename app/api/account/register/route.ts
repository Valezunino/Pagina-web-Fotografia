export async function POST() {
  return Response.json(
    { error: "El registro se realiza desde Mi cuenta para poder verificar el email." },
    { status: 410 },
  );
}
