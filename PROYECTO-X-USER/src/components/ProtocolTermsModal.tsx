import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProtocolTermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProtocolTermsModal: React.FC<ProtocolTermsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl transition-opacity animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/50 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-300 overflow-hidden mt-10 sm:mt-0">

                {/* Header - Fixed */}
                <div className="flex-none flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md relative z-10 sticky top-0">
                    <div>
                        <h2 className="text-sm md:text-base font-orbitron font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-geminix-accent shadow-[0_0_8px_rgba(0,255,255,0.8)]"></span>
                            Términos del Protocolo
                        </h2>
                        <p className="text-[10px] text-slate-400 font-mono mt-1 ml-3.5 uppercase tracking-wide">
                            Documento Vinculante - GK GEMINIX
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                        title="Cerrar"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar text-xs sm:text-sm text-slate-300 space-y-6">
                    <div className="p-4 bg-geminix-brand/10 border border-geminix-brand/20 rounded-xl mb-6">
                        <h3 className="text-geminix-brand font-bold uppercase tracking-widest text-[11px] mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Acuerdo Integro
                        </h3>
                        <p className="leading-relaxed opacity-90 text-[11px] sm:text-xs">
                            Al crear una cuenta en GK GEMINIX, usted acepta que ha leído, comprendido y está de acuerdo con todas las estipulaciones legales de este documento. La plataforma opera de manera descentralizada a través de tecnología blockchain.
                        </p>
                    </div>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">1.</span> Naturaleza de los Criptoactivos y Riesgo Tecnológico
                        </h4>
                        <p className="leading-relaxed opacity-80 pl-5 mb-3">
                            Los criptoactivos (incluyendo USDT, BNB, BTC y otros tokens del ecosistema BEP-20) no constituyen moneda de curso legal (fiat) en la mayoría de las jurisdicciones y no están respaldados por bancos centrales, gobiernos o mecanismos de garantía estatal. El Usuario reconoce que la tecnología Blockchain es experimental y está sujeta a riesgos intrínsecos de seguridad, errores de código (bugs) y cambios en los protocolos de red que están fuera del control de GK GEMINIX.
                        </p>
                        <p className="leading-relaxed opacity-80 pl-5">
                            La volatilidad de los criptoactivos es extrema. El valor de sus tenencias puede fluctuar drásticamente en periodos cortos de tiempo, e incluso llegar a cero. GK GEMINIX no asume responsabilidad alguna por la pérdida de valor de mercado de los activos depositados o generados.
                        </p>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">2.</span> Elegibilidad y Confirmación de Mayoría de Edad
                        </h4>
                        <p className="leading-relaxed opacity-80 pl-5">
                            El acceso al Protocolo está estrictamente limitado a personas naturales que tengan la plena capacidad legal para contratar según las leyes de su respectivo país de residencia y, en todo caso, que hayan cumplido un mínimo de <strong>18 años</strong>. Queda prohibido el uso de la plataforma a personas residentes en jurisdicciones donde la posesión o el comercio de criptoactivos esté explícitamente prohibido o restringido por leyes de valores.
                        </p>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">3.</span> Cláusula de Protección Matemática (Regla de Oro - CAP 200%)
                        </h4>
                        <div className="pl-5 space-y-3">
                            <p className="leading-relaxed opacity-80">
                                GK GEMINIX se rige por un motor de sostenibilidad algorítmica. Al activar cualquier Nodo, el Usuario acepta el "Límite de Duplicación" (CAP) inamovible:
                            </p>
                            <ul className="list-disc pl-5 opacity-80 space-y-2 text-[11px] sm:text-xs italic bg-slate-950/50 p-4 rounded-xl border border-white/5">
                                <li><strong>Límite de Retorno:</strong> Ninguna cuenta podrá generar más del <strong>200%</strong> de retorno total sobre su capital activo.</li>
                                <li><strong>Consolidación de Ganancias:</strong> Este CAP incluye la suma de ROI diario, bonos unilevel, comisiones de aceleración, bonos de rango y cualquier otro incentivo financiero.</li>
                                <li><strong>Caducidad:</strong> Una vez alcanzado el 200%, el Nodo se considera "Agotado" y deja de generar rendimientos. Para continuar, el Usuario debe realizar una nueva inyección de liquidez (Recarga).</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">4.</span> Responsabilidad en la Custodia y Seguridad del Usuario
                        </h4>
                        <p className="leading-relaxed opacity-80 pl-5 mb-3">
                            El Usuario es el único responsable de mantener la confidencialidad de sus credenciales de acceso, códigos de verificación de dos factores (2FA) y el acceso a su correo electrónico vinculado. GK GEMINIX **nunca** solicitará sus contraseñas ni frases semilla.
                        </p>
                        <p className="leading-relaxed opacity-80 pl-5">
                            Cualquier transacción realizada desde la cuenta del Usuario, ya sea autorizada o no por el mismo, se considerará válida y final. El Protocolo no cuenta con mecanismos para revertir transacciones blockchain exitosas derivadas de accesos no autorizados por descuido del Usuario.
                        </p>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">5.</span> Política de "Finalidad de Fondos" (No Reembolso)
                        </h4>
                        <p className="leading-relaxed opacity-80 pl-5 border-l-2 border-geminix-brand/30">
                            Debido a que los fondos depositados se inyectan inmediatamente en los pools de liquidez y algoritmos de arbitraje automatizado, todos los depósitos en GK GEMINIX son **irrevocables**. No existe periodo de retracto ni posibilidad de reembolso parcial o total una vez que los fondos han sido activados en el Protocolo.
                        </p>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">6.</span> Prevención contra el Lavado de Activos y Origen de Fondos
                        </h4>
                        <div className="pl-5 space-y-3">
                            <p className="leading-relaxed opacity-80">
                                El Usuario declara y garantiza que todos los criptoactivos depositados tienen un origen lícito y no están vinculados con actividades criminales bajo ninguna jurisdicción internacional.
                            </p>
                            <p className="leading-relaxed opacity-80 font-bold text-red-400">
                                GK GEMINIX se reserva el derecho de auditar el comportamiento transaccional y bloquear cualquier cuenta sospechosa de lavado de dinero, financiamiento del terrorismo o fraude sin previo aviso, en cumplimiento con estándares internacionales.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">7.</span> Privacidad y Tratamiento de Información Bancaria
                        </h4>
                        <p className="leading-relaxed opacity-80 pl-5">
                            GK GEMINIX no almacena información de tarjetas de crédito o cuentas bancarias tradicionales. Toda la interacción financiera se realiza a través de billeteras de criptoactivos personales. Los datos proporcionados durante el registro se utilizan estrictamente para la gestión operativa y de comunicación interna del Protocolo, y no serán vendidos a terceros.
                        </p>
                    </section>

                    <section>
                        <h4 className="text-white font-bold uppercase tracking-wide mb-3 flex items-center gap-2">
                            <span className="text-geminix-accent">8.</span> Resolución de Disputas y Ley Aplicable
                        </h4>
                        <p className="leading-relaxed opacity-80 pl-5">
                            Cualquier controversia relacionada con el uso del Protocolo se resolverá preferentemente mediante mediación técnica directa vía soporte. En caso de no alcanzarse un acuerdo, toda disputa se someterá a arbitraje bajo las leyes de la jurisdicción donde se encuentren alojados los nodos de computación principal, renunciando el Usuario a cualquier otro fuero que pudiera corresponderle.
                        </p>
                    </section>
                </div>

                {/* Footer - Fixed */}
                <div className="flex-none p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 relative z-10 sticky bottom-0 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-3">
                        Declaro que he leído y acepto estos términos
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-10 py-3 blue-brand-gradient text-white rounded-lg font-bold text-xs uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(0,191,255,0.2)] hover:shadow-[0_0_30px_rgba(0,191,255,0.4)] transition-all"
                    >
                        Entendido
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProtocolTermsModal;
