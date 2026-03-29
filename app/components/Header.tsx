export default function Header() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6"
      style={{
        backgroundColor: '#998DBD',
        height: '50px',
        fontSize: 20,
        fontWeight: 800,
        color: '#f0d0ff',
        letterSpacing: '0.05em',
      }}
    >
      <p>
        <span style={{ color: '#64469666' }}>✿</span>
          &nbsp;平成女児プロフ&nbsp;
        <span style={{ color: '#64469666' }}>✿</span>
      </p>
    </header>
  );
}
