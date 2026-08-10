import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label so different parts of the tree can be isolated (e.g. "Araçlar sekmesi") */
  boundaryName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — Bölüm 13 / Master Instruction Bölüm 13, 18.13:
 * "Bir component hata verdiğinde bütün React uygulaması beyaz ekrana
 * düşmemeli." Her sekme (Araçlar, Kredi Kartları, vb.) kendi ErrorBoundary'si
 * içine sarılır, böylece BİR sekmenin çökmesi diğerlerini etkilemez.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this should also report to an error tracking service.
    console.error(`[ErrorBoundary${this.props.boundaryName ? ' — ' + this.props.boundaryName : ''}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>
            {this.props.boundaryName ? `${this.props.boundaryName} yüklenemedi` : 'Bir şeyler ters gitti'}
          </h2>
          <p style={styles.message}>
            Bu bölümde beklenmeyen bir hata oluştu. Uygulamanın diğer kısımları çalışmaya devam ediyor.
          </p>
          <button style={styles.button} onClick={this.handleRetry}>
            Tekrar Dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
    minHeight: '200px',
  },
  icon: { fontSize: '32px', marginBottom: '8px' },
  title: { fontSize: '17px', fontWeight: 600, margin: '4px 0' },
  message: { fontSize: '14px', color: '#94A3B8', maxWidth: '320px' },
  button: {
    marginTop: '16px',
    padding: '10px 24px',
    borderRadius: '12px',
    border: 'none',
    background: '#22C55E',
    color: 'white',
    fontWeight: 600,
    fontSize: '14px',
  },
};
