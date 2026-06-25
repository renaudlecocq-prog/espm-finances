import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-lg font-semibold text-primary mb-3 pb-2 border-b border-gray-100">{title}</h2>
    <div className="text-sm text-primary-lighter leading-relaxed space-y-2">{children}</div>
  </section>
)

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary-lighter hover:text-primary mb-8 transition-colors">
          <ArrowLeft size={15} /> Retour
        </Link>

        <div className="mb-8">
          <img src="/logo-espm.png" alt="ESPM" className="h-10 mb-4" />
          <h1 className="text-2xl font-bold text-primary">Mentions légales</h1>
          <p className="text-sm text-primary-lighter mt-1">Module de gestion financière — <a href="https://espmaritime.netlify.app" className="hover:underline">espmaritime.netlify.app</a></p>
        </div>

        <Section title="1. Éditeur du site">
          <p><strong className="text-primary">École Secondaire Plurielle Maritime (ESPM)</strong></p>
          <p>Avenue Jean Dubrucq, 175<br />1080 Bruxelles — Belgique</p>
          <p>Téléphone : <a href="tel:+3222102090" className="hover:underline">02/210.20.90</a><br />
          E-mail : <a href="mailto:info@espmaritime.be" className="hover:underline">info@espmaritime.be</a><br />
          Site web : <a href="https://www.espmaritime.be" target="_blank" rel="noopener" className="hover:underline">www.espmaritime.be</a></p>
          <p>Numéro FASE : 95500<br />Numéro d'implantation : 10450</p>
          <p><strong className="text-primary">Pouvoir Organisateur :</strong> Pouvoir Organisateur Pluriel ASBL<br /></p>
          <p><strong className="text-primary">Responsable de publication :</strong> Économat de l'ESPM<br />
          Contact : <a href="mailto:renaud.lecocq@espmaritime.be" className="hover:underline">renaud.lecocq@espmaritime.be</a></p>
        </Section>

        <Section title="2. Hébergement">
          <p><strong className="text-primary">Hébergeur (frontend) :</strong><br />
          Netlify, Inc.<br />
          512 Second Street, Suite 200 — San Francisco, CA 94107, États-Unis<br />
          <a href="https://www.netlify.com" target="_blank" rel="noopener" className="hover:underline">www.netlify.com</a></p>
          <p><strong className="text-primary">Base de données :</strong><br />
          Supabase Inc. — serveurs hébergés dans la région <strong>eu-west-1 (Irlande, UE)</strong>, conformément au RGPD.<br />
          <a href="https://supabase.com" target="_blank" rel="noopener" className="hover:underline">supabase.com</a></p>
          <p><strong className="text-primary">Authentification (SSO) :</strong><br />
          Smartschool — Smartbit SComm, Skaldenstraat 7 — 9042 Gent, Belgique.<br />
          <a href="https://www.smartschool.be" target="_blank" rel="noopener" className="hover:underline">www.smartschool.be</a></p>
        </Section>

        <Section title="3. Objet de l'application">
          <p>Ce module est un outil interne à usage exclusif de l'École Secondaire Plurielle Maritime. Il permet :</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>aux membres du personnel (économat, direction) de gérer les factures, paiements et activités extrascolaires ;</li>
            <li>aux enseignants et éducateurs de soumettre des demandes d'activités ;</li>
            <li>aux responsables légaux (parents) et aux élèves majeurs de consulter l'état de leur compte financier.</li>
          </ul>
          <p>L'accès est strictement limité aux utilisateurs autorisés par l'établissement, via Smartschool ou par invitation directe.</p>
        </Section>

        <Section title="4. Protection des données personnelles (RGPD)">
          <p><strong className="text-primary">Responsable du traitement :</strong><br />
          École Secondaire Plurielle Maritime — Avenue Jean Dubrucq, 175 — 1080 Bruxelles</p>

          <p><strong className="text-primary">Données collectées :</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Identité : nom, prénom, adresse e-mail ;</li>
            <li>Identifiants scolaires : matricule (stamboeknummer ProEco/Smartschool), classe ;</li>
            <li>Données financières : montants facturés, paiements, soldes, échelonnements ;</li>
            <li>Données de connexion : horodatage des sessions, méthode d'authentification.</li>
          </ul>

          <p><strong className="text-primary">Finalités du traitement :</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Gestion administrative et financière de l'établissement ;</li>
            <li>Information des responsables légaux sur la situation financière de leur enfant ;</li>
            <li>Suivi des activités extrascolaires et voyages scolaires.</li>
          </ul>

          <p><strong className="text-primary">Base légale :</strong> obligation légale (comptabilité scolaire) et intérêt légitime de l'établissement.</p>

          <p><strong className="text-primary">Durée de conservation :</strong> les données financières sont conservées conformément aux obligations légales comptables belges (7 ans). Les comptes inactifs sont supprimés à l'issue de la scolarité.</p>

          <p><strong className="text-primary">Destinataires :</strong> les données ne sont pas transmises à des tiers à des fins commerciales. Seuls les prestataires techniques listés à l'article 2 y accèdent, dans le cadre strict de leur mission d'hébergement.</p>

          <p><strong className="text-primary">Vos droits :</strong> conformément au Règlement (UE) 2016/679 (RGPD), vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et de portabilité de vos données, ainsi que d'un droit d'opposition. Pour exercer ces droits, contactez : <a href="mailto:info@espmaritime.be" className="hover:underline">info@espmaritime.be</a></p>

          <p>Vous pouvez également introduire une réclamation auprès de l'<strong>Autorité de Protection des Données (APD)</strong> :<br />
          Rue de la Presse 35 — 1000 Bruxelles — <a href="https://www.autoriteprotectiondonnees.be" target="_blank" rel="noopener" className="hover:underline">autoriteprotectiondonnees.be</a></p>
        </Section>

        <Section title="5. Cookies">
          <p>Ce module utilise uniquement des cookies techniques strictement nécessaires au fonctionnement de l'authentification et du maintien de session. Aucun cookie publicitaire ou de traçage tiers n'est utilisé.</p>
        </Section>

        <Section title="6. Propriété intellectuelle">
          <p>L'ensemble des contenus de ce module (code, textes, logos) est la propriété exclusive de l'École Secondaire Plurielle Maritime ou de ses partenaires. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.</p>
          <p>Le logo ESPM et les marques associées sont la propriété du Pouvoir Organisateur Pluriel ASBL.</p>
        </Section>

        <Section title="7. Développement">
          <p>Ce module a été conçu et développé au sein de l'ESPM par :</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-primary">Renaud Lecocq</strong> — conception, architecture et développement de l'application (ESPM+) ;<br />
              <span className="text-primary-lighter">Économe, École Secondaire Plurielle Maritime</span>
            </li>
            <li>
              <strong className="text-primary">Francesc Altes</strong> — conception du module <em>Conseils de guidance</em> (prototype original) ; bêta testeur des fonctions en développement ;<br />
              <span className="text-primary-lighter">Membre du personnel, École Secondaire Plurielle Maritime</span>
            </li>
          </ul>
          <p>Ce logiciel est un développement interne, non commercial, destiné exclusivement à l'usage de l'établissement. Le code source n'est pas distribué publiquement.</p>
        </Section>

        <Section title="8. Responsabilité">
          <p>L'ESPM s'efforce de maintenir ce module à jour et disponible. En cas d'indisponibilité temporaire pour maintenance ou incident technique, la responsabilité de l'école ne pourra être engagée.</p>
          <p>Les données affichées sont issues des systèmes internes de l'école (ProEco, Smartschool). En cas d'erreur ou de divergence, contactez l'économat : <a href="mailto:renaud.lecocq@espmaritime.be" className="hover:underline">renaud.lecocq@espmaritime.be</a></p>
        </Section>

        <p className="text-xs text-primary-lighter border-t border-gray-100 pt-6 mt-4">
          Dernière mise à jour : juin 2026 · École Secondaire Plurielle Maritime · v1.04
        </p>
      </div>
    </div>
  )
}
