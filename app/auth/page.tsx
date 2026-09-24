import AuthForm from "@/components/auth-form";

export default function AuthPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "url(https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-5xl px-8 py-16 flex-1">
        <AuthForm />
      </main>
    </div>
  );
}
