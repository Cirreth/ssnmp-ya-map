#ifndef YaMapApi
#define YaMapApi

#include <IdHTTP.hpp>
#include <vector>

using namespace std;
typedef pair<float, float> mapCoordinate;
typedef vector< pair<float,float> > mapCoordinates;
struct MapObject {
	UnicodeString id;
	mapCoordinate position;
	UnicodeString type;
};
typedef vector<MapObject> MapObjects;

class MapAPI
{

	private:
		UnicodeString _url;
		UnicodeString _pathToExecutable;
		TIdHTTP *_http;

		void SendCommand(UnicodeString requestBody, TStringStream *stream) {
			TStringStream *params = new TStringStream(requestBody, TEncoding::UTF8, true);
			_http->Post(_url, params, stream);
			delete params;
		}

	public:
		MapAPI(UnicodeString pathToExecutable, UnicodeString url) {
			_pathToExecutable = pathToExecutable;
			_url = url;
			_http = new TIdHTTP(NULL);
			_http->Request->ContentType = "application/json";
			_http->Request->CharSet = "utf-8";
			DecimalSeparator = '.';
		}

		void initMap() {
			ShellExecuteA(NULL, "Open", AnsiString(_pathToExecutable).c_str(), "", "", 1);
		}

		void setCallPosition(float lat, float lng) {
			SendCommand("{\"action\": \"setCallPosition\", \"position\": [" +FloatToStr(lat) + "," + FloatToStr(lng) + "]}", NULL);
		}

		void clearCallPosition() {
			SendCommand("{\"action\": \"clearCallPosition\"}", NULL);
		}

		void showCircle(float lat, float lng, int radius) {
			SendCommand("{\"action\": \"showCircle\", \"position\": [" + FloatToStr(lat) + "," + FloatToStr(lng) + "], \"radius\": " + IntToStr(radius) + "}", NULL);
		}

		void hideCircle() {
			SendCommand("{\"action\": \"hideCircle\"}", NULL);
		}

		void setCenter(float lat, float lng) {
			SendCommand("{\"action\": \"setCenter\", \"position\": [" +FloatToStr(lat) + "," + FloatToStr(lng) + "]}", NULL);
		}

		void setZoom(int zoom) {
			SendCommand("{\"action\": \"setZoom\", \"zoom\": "+IntToStr(zoom)+"}", NULL);
		}

		void addBalloon(UnicodeString text, float lat, float lng) {
			SendCommand("{\"action\": \"addBalloon\", \"text\": \"" + text + "\" ,\"position\": [" +FloatToStr(lat) + "," + FloatToStr(lng) + "]}", NULL);
		}

		void removeAllBalloons() {
			SendCommand("{\"action\": \"removeAllBalloons\"}", NULL);
		}

		void addAmbulance(UnicodeString ambulanceId, float lat, float lng) {
			SendCommand("{\"action\": \"addAmbulance\", \"ambulance\": {\"id\": \""+ambulanceId+"\", \"position\": [" +FloatToStr(lat) + "," + FloatToStr(lng) + "]}}", NULL);
		}

		void addAmbulance(UnicodeString ambulanceId, float lat, float lng, UnicodeString type) {
			SendCommand("{\"action\": \"addAmbulance\", \"ambulance\":{\"id\": \""+ambulanceId+"\", \"position\": [" +FloatToStr(lat) + "," + FloatToStr(lng) + "], \"type\": \"" + type + "\"}}", NULL);
		}

		void addAmbulances(MapObjects &abmulances) {
			_doWithAmbulances("addAmbulances", abmulances);
		}

		void updateAmbulance(MapObject &ambulance) {
			SendCommand("{\"action\":\"updateAmbulance\", \"ambulance\":{\"id\": \""+ambulance.id+"\", \"position\": [" +ambulance.position.first + "," + ambulance.position.second + "], \"type\": \"" + ambulance.type + "\"}}", NULL);
		}

		void updateAmbulances(MapObjects &abmulances) {
			_doWithAmbulances("updateAmbulances", abmulances);
		}

		void removeAllAmbulances() {
			SendCommand("{\"action\": \"removeAllAmbulances\"}", NULL);
		}

		void addHospital(MapObject &hospital) {
			SendCommand("{\"action\": \"addHospital\", \"hospital\": {\"id\": \""+hospital.id+"\", \"position\": [" + hospital.position.first + "," + hospital.position.second + "]}}", NULL);
		}

		void removeAllHospitals() {
			SendCommand("{\"action\": \"removeAllHospitals\"}", NULL);
		}

		void route(mapCoordinate &from, mapCoordinate &to, bool avoidTrafficJams) {
			UnicodeString strFromCoords = "[" + FloatToStr(from.first) + "," + FloatToStr(from.second) + "]";
			UnicodeString strToCoords = "[" + FloatToStr(to.first) + "," + FloatToStr(to.second) + "]";
			SendCommand("{\"action\": \"route\", \"from\": " + strFromCoords + ", \"to\": " + strToCoords + ", \"avoidTrafficJams\": " + BoolToStr(avoidTrafficJams) + "}", NULL);
		}

		void routeDefault() {
			SendCommand("{\"action\": \"routeDefault\"}", NULL);
		}

		void clearRoute() {
			SendCommand("{\"action\": \"clearRoute\"}", NULL);
		}

	private:

		void _doWithAmbulances(UnicodeString action, MapObjects &ambulances) {
			UnicodeString ambulancesJSON = "[";
			MapObjects::iterator it = ambulances.begin();
			MapObject ambulance;
			for(MapObjects::iterator it = ambulances.begin(); it != ambulances.end(); ++it) {
				ambulance = *it;
				ambulancesJSON += "{\"id\": \""+ambulance.id+"\", \"position\":";
				ambulancesJSON += "["+FloatToStr(ambulance.position.first) + "," + FloatToStr(ambulance.position.second) + "]";
				if (!ambulance.type.IsEmpty()) {
					ambulancesJSON += ", \"type\": \"" + ambulance.type + "\"";
				}
				ambulancesJSON += "},";
			}
			// стираем запятую в конце
			ambulancesJSON = ambulancesJSON.SubString(0, ambulancesJSON.Length()-1);
			ambulancesJSON += "]";
			SendCommand("{\"action\": \""+action+"\", \"ambulances\": "+ambulancesJSON+"}", NULL);
		}

};


#endif

