import { polygonArea } from "../geometry";
import { toDisplayLength, toInternalLength } from "../app/units";
import type { Room } from "../types";
import { NumericField } from "./NumericField";

type RoomCardProps = {
  room: Room;
  unit: "mm" | "cm";
  active: boolean;
  editMode: boolean;
  allowPatternShift: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onChange: (room: Room) => void;
  onAddPoint: () => void;
};

export function RoomCard({ room, unit, active, editMode, allowPatternShift, onSelect, onDelete, onChange, onAddPoint }: RoomCardProps) {
  const areaSquareMeters = room.closed && room.points.length >= 3 ? polygonArea(room.points) / 1_000_000 : null;

  return (
    <article className={`room-card ${active ? "active" : ""}`}>
      <div className="room-header">
        <input value={room.name} disabled={!editMode} onChange={(event) => onChange({ ...room, name: event.target.value })} />
        <div className="button-row compact">
          <button className="secondary" type="button" onClick={onSelect}>Aktywny</button>
          <button className="danger" type="button" onClick={onDelete} disabled={!editMode}>Usuń</button>
        </div>
      </div>

      <div className="grid two compact-grid">
        <label>
          Punktów
          <input readOnly value={`${room.points.length} / ${room.closed ? "zamknięty" : "otwarty"}`} />
        </label>
        <label>
          Kolor
          <input type="color" value={room.color} disabled={!editMode} onChange={(event) => onChange({ ...room, color: event.target.value })} />
        </label>
        <label>
          Powierzchnia
          <input readOnly value={areaSquareMeters === null ? "—" : `${areaSquareMeters.toFixed(2)} m²`} />
        </label>
      </div>

      <div className="point-tools">
        <button className="secondary" type="button" onClick={() => onChange({ ...room, closed: room.points.length >= 3 })} disabled={!editMode}>Zamknij wielokąt</button>
        <button className="secondary" type="button" onClick={onAddPoint} disabled={!editMode}>Dodaj punkt</button>
      </div>

      <div className="grid two compact-grid">
        <NumericField
          label="Wzór X"
          value={room.patternShiftX}
          unit={unit}
          disabled={!editMode || !allowPatternShift}
          onChange={(value) => onChange({ ...room, patternShiftX: value })}
        />
        <NumericField
          label="Wzór Y"
          value={room.patternShiftY}
          unit={unit}
          disabled={!editMode || !allowPatternShift}
          onChange={(value) => onChange({ ...room, patternShiftY: value })}
        />
      </div>
      <p className="hint">
        Przesunięcie pokoju jest dodawane do globalnego przesunięcia wzoru i działa po włączeniu dylatacji między pokojami.
      </p>

      <div className="points-table-wrap">
        <table className="points-table">
          <thead>
            <tr>
              <th>#</th>
              <th>X</th>
              <th>Y</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {room.points.map((point, index) => (
              <tr key={`${room.id}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <input
                    type="number"
                    step="1"
                    value={toDisplayLength(point.x, unit)}
                    disabled={!editMode}
                    onChange={(event) =>
                      onChange({
                        ...room,
                        points: room.points.map((entry, pointIndex) => (pointIndex === index ? { ...entry, x: toInternalLength(Number(event.target.value), unit) } : entry)),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1"
                    value={toDisplayLength(point.y, unit)}
                    disabled={!editMode}
                    onChange={(event) =>
                      onChange({
                        ...room,
                        points: room.points.map((entry, pointIndex) => (pointIndex === index ? { ...entry, y: toInternalLength(Number(event.target.value), unit) } : entry)),
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    className="danger"
                    type="button"
                    disabled={!editMode}
                    onClick={() =>
                      onChange({
                        ...room,
                        closed: room.points.length - 1 >= 3 ? room.closed : false,
                        points: room.points.filter((_, pointIndex) => pointIndex !== index),
                      })
                    }
                  >
                    x
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
