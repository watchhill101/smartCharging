import React from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

const Scan: React.FC = () => {
  return (
    <>
      <div>
        <Scanner
          onScan={(result) => console.log(result)}
        />
      </div>
    </>
  );
};

export default Scan;
