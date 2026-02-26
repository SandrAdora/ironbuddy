import { useState } from 'react';
import { Navbar, Nav, Container, Modal } from 'react-bootstrap';
import OnboardingForm from './Register.jsx';

export default function HomepageNavbar() {
  const [showRegister, setShowRegister] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="/">Logo</Navbar.Brand>
          <Nav.Link 
            onClick={() => {
              setAcceptedDisclaimer(false); // Reset bei jedem Öffnen
              setShowRegister(true);
            }} 
            style={{cursor: 'pointer'}}
          >
            Signup Now
          </Nav.Link>
        </Container>
      </Navbar>

      <Modal show={showRegister} onHide={() => setShowRegister(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Before You Start</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {!acceptedDisclaimer && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                IronBuddy is an AI-powered fitness assistant.  
                Before you continue, please confirm the following:
              </p>

              <label className="flex items-start gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={acceptedDisclaimer}
                  onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                />
                <span>
                  I understand that IronBuddy is an AI-powered tool and does not replace 
                  professional medical advice. I will consult a physician before starting 
                  any new training or supplement program.
                </span>
              </label>
            </div>
          )}

          {acceptedDisclaimer && (
            <OnboardingForm />
          )}
        </Modal.Body>

        <Modal.Footer>
          {!acceptedDisclaimer ? (
            <button
              className="btn btn-primary"
              disabled={!acceptedDisclaimer}
              onClick={() => setAcceptedDisclaimer(true)}
            >
              I Agree
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => setShowRegister(false)}
            >
              Close
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}
