import { useState } from "react";
import type { AuthSession } from "../../../shared/types/domain";
import { Alert, Button, Card, PageHeader } from "../../design-system";
import { PasswordField } from "../auth/AuthPages";

export function ChangePasswordPage({ session, onSession, mandatory }: { session: AuthSession; onSession: (session: AuthSession) => void; mandatory?: boolean }): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    if (!newPassword) {
      setError("Informe a nova senha.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmacao nao bate com a nova senha.");
      return;
    }
    setLoading(true);
    try {
      await window.operationsCafe.authChangePassword({ currentPassword, newPassword });
      const refreshed = await window.operationsCafe.authCurrentSession();
      if (refreshed) onSession(refreshed);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel trocar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-section">
      <PageHeader eyebrow="Minha conta" title="Trocar senha" description={mandatory ? "Defina uma senha nova sua antes de continuar." : `Alterar a senha de acesso de ${session.user.displayName}.`} />
      <Card>
        {mandatory ? <Alert tone="info">Por seguranca, defina uma senha sua antes de usar o sistema.</Alert> : null}
        <PasswordField label="Senha atual" value={currentPassword} onChange={setCurrentPassword} autoFocus />
        <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} />
        <PasswordField label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="actions">
          <Button variant="primary" onClick={() => void submit()} loading={loading}>Salvar nova senha</Button>
        </div>
      </Card>
    </section>
  );
}
