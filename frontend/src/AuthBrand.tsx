import logo from './assets/auth/finclear-logo.png';

export default function AuthBrand() {
  return <div className="login-brand" aria-label="FinClear">
    <span className="login-logo"><img src={logo} alt="" /></span><span>FinClear</span>
  </div>;
}
